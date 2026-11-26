/**
 * Laboratório do chat que roda inteiro no navegador (GitHub Pages, sem servidor).
 *
 * Mesmo fluxo da pesquisa do app: recuperar → gerar → verificar. Muda só a origem:
 * a base é a semente embutida e o modelo é chamado direto do navegador, com a chave
 * que o próprio desenvolvedor cola (guardada só no navegador dele). Nada é registrado.
 * Uso exclusivo para teste: chave no navegador é aceitável só para quem é dono dela.
 */
import Anthropic from "@anthropic-ai/sdk";
import { recuperarLocal } from "./base-local";
import { SISTEMA_PESQUISA, lerResposta, montarMensagem, respostaExtrativa } from "./geracao";
import type { DesfechoPesquisa, Diagnostico, RespostaModelo, Trecho } from "./tipos";
import { verificarCitacoes } from "./verificador";

export type ModoLab = "extrativo" | "simulado-inventado" | "anthropic";

/** Preço da Anthropic em US$ por milhão de tokens (entrada, saída). */
export const MODELOS_LAB = [
  { id: "claude-opus-5-5", nome: "Claude Opus 5.5", entrada: 4, saida: 20 },
  { id: "claude-sonnet-5-5", nome: "Claude Sonnet 5.5", entrada: 2, saida: 10 },
  { id: "claude-haiku-5-5", nome: "Claude Haiku 5.5", entrada: 0.1, saida: 0.5 },
] as const;

export interface PedidoLab {
  pergunta: string;
  data: string;
  modo: ModoLab;
  chave?: string;
  modelo?: string;
}

/**
 * Resposta de propósito errada: inventa um dispositivo (D99) e "cita" um texto que não
 * está na base. Serve para ver o verificador bloquear, sem gastar chamada de modelo.
 */
function respostaInventada(fontes: Trecho[]): RespostaModelo {
  const base = respostaExtrativa(fontes, 1);
  return {
    paragrafos: [...base.paragrafos, "A alíquota da CBS em 2026 é de 12% para todos os serviços [D99]."],
    citacoes: [...base.citacoes, { ref: "D99", trecho: "a CBS será cobrada à alíquota de 12% sobre todos os serviços" }],
  };
}

async function chamarAnthropic(chave: string, modelo: string, sistema: string, mensagem: string) {
  const client = new Anthropic({ apiKey: chave, dangerouslyAllowBrowser: true });
  // Opus e Sonnet aceitam o fallback do servidor: se o modelo recusar, a própria API tenta outro.
  const comFallback = !modelo.startsWith("claude-haiku");
  const r = await client.beta.messages.create({
    model: modelo,
    max_tokens: 16000,
    system: sistema,
    messages: [{ role: "user", content: mensagem }],
    ...(comFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  const texto = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { r, texto };
}

export async function rodarLab(p: PedidoLab): Promise<{ desfecho: DesfechoPesquisa; diagnostico: Diagnostico }> {
  const inicio = performance.now();
  const id = `lab-${Date.now()}`;
  const nomeProvedor = p.modo === "anthropic" ? "anthropic (navegador)" : p.modo === "extrativo" ? "extrativo" : "simulado";
  const diag: Diagnostico = {
    provedor: nomeProvedor,
    modelo: p.modo === "anthropic" ? (p.modelo ?? "") : nomeProvedor,
    sistema: null,
    mensagem: null,
    saidaBruta: null,
    respostaLida: null,
    ms: { recuperacao: 0, modelo: 0, verificacao: 0, total: 0 },
    tokens: { entrada: null, saida: null },
    custoMicroreais: null,
    custoUsd: null,
  };
  const fim = (desfecho: DesfechoPesquisa) => {
    diag.ms.total = Math.round(performance.now() - inicio);
    return { desfecho, diagnostico: diag };
  };

  let t = performance.now();
  const fontes = recuperarLocal(p.pergunta, p.data);
  diag.ms.recuperacao = Math.round(performance.now() - t);
  if (fontes.length === 0) return fim({ status: "sem_resultado", id, fontes: [] });

  let resposta: RespostaModelo | null;
  t = performance.now();
  try {
    if (p.modo === "anthropic") {
      if (!p.chave) throw new Error("Cole sua chave da Anthropic para usar o modelo de verdade.");
      const modelo = p.modelo ?? MODELOS_LAB[0].id;
      diag.sistema = SISTEMA_PESQUISA;
      diag.mensagem = montarMensagem(p.pergunta, p.data, fontes);
      const { r, texto } = await chamarAnthropic(p.chave, modelo, diag.sistema, diag.mensagem);
      diag.modelo = r.model;
      diag.saidaBruta = texto || `(sem texto; stop_reason: ${r.stop_reason})`;
      diag.tokens = { entrada: r.usage.input_tokens, saida: r.usage.output_tokens };
      const preco = MODELOS_LAB.find((m) => m.id === r.model);
      if (preco) diag.custoUsd = (r.usage.input_tokens * preco.entrada + r.usage.output_tokens * preco.saida) / 1_000_000;
      if (r.stop_reason === "refusal") {
        diag.ms.modelo = Math.round(performance.now() - t);
        return fim({ status: "erro", id, mensagem: "O modelo recusou a pergunta (stop_reason: refusal).", fontes });
      }
      resposta = lerResposta(texto);
    } else {
      resposta = p.modo === "extrativo" ? respostaExtrativa(fontes) : respostaInventada(fontes);
      diag.custoUsd = 0;
    }
  } catch (e) {
    diag.ms.modelo = Math.round(performance.now() - t);
    diag.erro = e instanceof Anthropic.APIError ? `${e.status ?? ""} ${e.message}`.trim() : (e as Error).message;
    const mensagem =
      e instanceof Anthropic.AuthenticationError
        ? "A chave da Anthropic foi recusada. Confira se colou a chave inteira."
        : e instanceof Anthropic.RateLimitError
          ? "Limite de uso da conta Anthropic atingido. Tente de novo em instantes."
          : "O modelo não respondeu. Veja o erro técnico abaixo.";
    return fim({ status: "erro", id, mensagem, fontes });
  }
  diag.ms.modelo = Math.round(performance.now() - t);
  diag.respostaLida = resposta;

  t = performance.now();
  const modelo = diag.modelo;
  let desfecho: DesfechoPesquisa;
  if (!resposta) {
    desfecho = { status: "bloqueada_citacao", id, motivos: ["A resposta do modelo não veio no formato verificável."], fontes, modelo };
  } else {
    const v = verificarCitacoes(resposta, fontes);
    desfecho = v.ok
      ? { status: "respondida", id, paragrafos: resposta.paragrafos, citacoes: v.citacoes, fontes, redigida: p.modo === "anthropic", modelo }
      : { status: "bloqueada_citacao", id, motivos: v.motivos, fontes, modelo };
  }
  diag.ms.verificacao = Math.round(performance.now() - t);
  return fim(desfecho);
}
