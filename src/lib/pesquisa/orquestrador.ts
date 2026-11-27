import "server-only";
import type { DocumentoAnexo } from "./geracao";
import { consultar, noEscritorio, type Contexto } from "@/lib/db";
import { ProvedorExtrativo, provedor } from "@/lib/llm/provedores";
import { ErroLLM } from "@/lib/llm/tipos";
import type { DesfechoPesquisa, Diagnostico, Trecho } from "./tipos";
import { responder } from "./responder";
import { expandirPergunta, selecionarFontes } from "./termos";
import { paraTrecho } from "./trecho";
import { registrarErro } from "@/lib/registro-erros";

export type { DesfechoPesquisa, Diagnostico } from "./tipos";

/** Em produção, só o que o curador publicou. Em desenvolvimento ou beta sem curador, tudo (marcado). */
export function incluirNaoRevisados(): boolean {
  return process.env.BASE_INCLUIR_NAO_REVISADOS === "1" || process.env.NODE_ENV !== "production";
}

export async function recuperar(pergunta: string, data: string, limite = 8): Promise<Trecho[]> {
  const linhas = await consultar(`select * from pesquisar_dispositivos($1, $2::date, $3, $4)`, [
    expandirPergunta(pergunta),
    data,
    limite,
    incluirNaoRevisados(),
  ]);
  return selecionarFontes(pergunta, linhas.map(paraTrecho));
}

/** Recuperar → gerar → verificar → registrar. Cada passo explícito e auditável. */
export async function pesquisar(
  ctx: Contexto,
  pergunta: string,
  data: string,
  casoId?: string | null,
  opcoes: { forcarExtrativo?: boolean; aoDiagnosticar?: (d: Diagnostico) => void; documentos?: DocumentoAnexo[] } = {},
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
      const { resultado, bastidores: b } = await responder(llm, pergunta, data, fontes, opcoes.documentos ?? []);
      tokens = { ent: b.tokens.entrada, sai: b.tokens.saida, custo: b.tokens.custo, modelo: b.tokens.modelo };
      diag.sistema = b.sistema;
      diag.mensagem = b.mensagem;
      diag.saidaBruta = b.saidaBruta;
      diag.respostaLida = b.respostaLida;
      diag.ms.modelo = b.ms.modelo;
      diag.ms.verificacao = b.ms.verificacao;
      desfecho =
        resultado.status === "respondida"
          ? { status: "respondida", id, paragrafos: resultado.paragrafos, citacoes: resultado.citacoes, fontes, redigida: llm.redige, modelo: tokens.modelo }
          : { status: "bloqueada_citacao", id, motivos: resultado.motivos, fontes, modelo: tokens.modelo };
    }
  } catch (e) {
    diag.erro = (e as Error).message;
    // Só o técnico: a pergunta do advogado não entra no registro de erros.
    await registrarErro("pesquisa", e, {
      rota: "/app/pesquisa",
      usuarioId: ctx.usuarioId,
      escritorioId: ctx.escritorioId,
      codigo: e instanceof ErroLLM ? "llm" : null,
      detalhes: { consulta: id, provedor: llm.nome },
    });
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
