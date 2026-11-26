import "server-only";
import { consultar, noEscritorio, type Contexto } from "@/lib/db";
import { ProvedorExtrativo, provedor } from "@/lib/llm/provedores";
import { ErroLLM } from "@/lib/llm/tipos";
import { SISTEMA_PESQUISA, lerResposta, montarMensagem, respostaExtrativa } from "./geracao";
import type { CitacaoVerificada, Trecho } from "./tipos";
import { verificarCitacoes } from "./verificador";

export type DesfechoPesquisa =
  | {
      status: "respondida";
      id: string;
      paragrafos: string[];
      citacoes: CitacaoVerificada[];
      fontes: Trecho[];
      redigida: boolean;
      modelo: string;
    }
  | { status: "bloqueada_citacao"; id: string; motivos: string[]; fontes: Trecho[]; modelo: string }
  | { status: "sem_resultado"; id: string; fontes: [] }
  | { status: "erro"; id: string; mensagem: string; fontes: Trecho[] };

/** Bastidores de uma consulta, para a página de desenvolvedor. Nunca vai para o advogado. */
export interface Diagnostico {
  provedor: string;
  modelo: string;
  sistema: string | null;
  mensagem: string | null;
  saidaBruta: string | null;
  respostaLida: unknown;
  ms: { recuperacao: number; modelo: number; verificacao: number; total: number };
  tokens: { entrada: number | null; saida: number | null };
  custoMicroreais: number | null;
  erro?: string;
}

/** Em produção, só o que o curador publicou. Em desenvolvimento ou beta sem curador, tudo (marcado). */
export function incluirNaoRevisados(): boolean {
  return process.env.BASE_INCLUIR_NAO_REVISADOS === "1" || process.env.NODE_ENV !== "production";
}

export async function recuperar(pergunta: string, data: string, limite = 8): Promise<Trecho[]> {
  const linhas = await consultar(`select * from pesquisar_dispositivos($1, $2::date, $3, $4)`, [
    pergunta,
    data,
    limite,
    incluirNaoRevisados(),
  ]);
  return linhas.map((l: any, i: number) => ({
    ref: `D${i + 1}`,
    id: l.id,
    norma: `${l.norma_tipo} ${l.norma_numero}/${l.norma_ano}`,
    ementa: l.norma_ementa,
    url: l.url_oficial,
    rotulo: l.rotulo,
    texto: l.texto,
    vigenciaInicio: iso(l.vigencia_inicio),
    vigenciaFim: l.vigencia_fim ? iso(l.vigencia_fim) : null,
    curadoria: l.status_curadoria,
    origem: l.origem,
  }));
}

function iso(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/** Recuperar → gerar → verificar → registrar. Cada passo explícito e auditável. */
export async function pesquisar(
  ctx: Contexto,
  pergunta: string,
  data: string,
  casoId?: string | null,
  opcoes: { forcarExtrativo?: boolean; aoDiagnosticar?: (d: Diagnostico) => void } = {},
): Promise<DesfechoPesquisa> {
  const inicio = Date.now();
  const llm = opcoes.forcarExtrativo ? new ProvedorExtrativo() : provedor();
  const diag: Diagnostico = {
    provedor: llm.nome, modelo: llm.nome, sistema: null, mensagem: null, saidaBruta: null, respostaLida: null,
    ms: { recuperacao: 0, modelo: 0, verificacao: 0, total: 0 }, tokens: { entrada: null, saida: null }, custoMicroreais: null,
  };

  const { id } = await noEscritorio(ctx, async (c) => {
    const r = await c.query(
      `insert into consultas (escritorio_id, caso_id, usuario_id, pergunta, data_referencia, modelo)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [ctx.escritorioId, casoId ?? null, ctx.usuarioId, pergunta, data, llm.nome],
    );
    return r.rows[0];
  });

  let desfecho: DesfechoPesquisa;
  let tokens = { ent: null as number | null, sai: null as number | null, custo: null as number | null, modelo: llm.nome };

  try {
    let t = Date.now();
    const fontes = await recuperar(pergunta, data);
    diag.ms.recuperacao = Date.now() - t;
    if (fontes.length === 0) {
      desfecho = { status: "sem_resultado", id, fontes: [] };
    } else {
      let resposta;
      t = Date.now();
      if (llm.redige) {
        diag.sistema = SISTEMA_PESQUISA;
        diag.mensagem = montarMensagem(pergunta, data, fontes);
        const r = await llm.gerar({ tarefa: "pesquisa", sistema: diag.sistema, mensagem: diag.mensagem, json: true, maxTokens: 2048 });
        tokens = { ent: r.tokensEntrada, sai: r.tokensSaida, custo: r.custoMicroreais, modelo: r.modelo };
        diag.saidaBruta = r.texto;
        resposta = lerResposta(r.texto);
      } else {
        resposta = respostaExtrativa(fontes);
      }
      diag.ms.modelo = Date.now() - t;
      diag.respostaLida = resposta;
      t = Date.now();
      if (!resposta) {
        desfecho = { status: "bloqueada_citacao", id, motivos: ["A resposta do modelo não veio no formato verificável."], fontes, modelo: tokens.modelo };
      } else {
        const v = verificarCitacoes(resposta, fontes);
        desfecho = v.ok
          ? { status: "respondida", id, paragrafos: resposta.paragrafos, citacoes: v.citacoes, fontes, redigida: llm.redige, modelo: tokens.modelo }
          : { status: "bloqueada_citacao", id, motivos: v.motivos, fontes, modelo: tokens.modelo };
      }
      diag.ms.verificacao = Date.now() - t;
    }
  } catch (e) {
    console.error("pesquisa", (e as Error).message);
    diag.erro = (e as Error).message;
    desfecho = {
      status: "erro",
      id,
      mensagem: e instanceof ErroLLM ? "O serviço de IA não respondeu. Tente de novo em instantes." : "Não foi possível concluir a pesquisa.",
      fontes: [],
    };
  }

  const statusBanco = desfecho.status === "sem_resultado" ? "respondida" : desfecho.status;
  await noEscritorio(ctx, async (c) => {
    await c.query(
      `update consultas set status = $2, resposta = $3, citacoes = $4, motivo_bloqueio = $5, modelo = $6,
         tokens_entrada = $7, tokens_saida = $8, custo_microreais = $9, ms_total = $10
       where id = $1`,
      [
        id,
        statusBanco,
        desfecho.status === "respondida" ? desfecho.paragrafos.join("\n\n") : null,
        JSON.stringify(
          desfecho.status === "respondida"
            ? desfecho.citacoes.map((c) => ({ ref: c.ref, dispositivo_id: c.dispositivo.id, trecho: c.trecho }))
            : [],
        ),
        desfecho.status === "bloqueada_citacao" ? desfecho.motivos.join(" | ") : null,
        tokens.modelo,
        tokens.ent,
        tokens.sai,
        tokens.custo,
        Date.now() - inicio,
      ],
    );
    await c.query(`insert into auditoria (escritorio_id, usuario_id, acao, alvo_id, detalhes) values ($1, $2, 'consulta', $3, $4)`, [
      ctx.escritorioId,
      ctx.usuarioId,
      id,
      JSON.stringify({ status: desfecho.status, fontes: desfecho.fontes.map((f) => f.id), modelo: tokens.modelo }),
    ]);
  });

  diag.modelo = tokens.modelo;
  diag.tokens = { entrada: tokens.ent, saida: tokens.sai };
  diag.custoMicroreais = tokens.custo;
  diag.ms.total = Date.now() - inicio;
  opcoes.aoDiagnosticar?.(diag);
  return desfecho;
}
