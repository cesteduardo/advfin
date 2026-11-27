/**
 * Partes puras da pesquisa: o pedido ao modelo, a leitura da resposta e a
 * resposta extrativa (sem modelo). Nada aqui toca rede ou banco.
 */
import type { RespostaModelo, Trecho } from "./tipos";

export const SISTEMA_PESQUISA = `Você apoia advogados tributaristas brasileiros. Responda em português do Brasil, em tom de parecer: claro, preciso, sem floreio.

Regras inegociáveis:
1. Use SOMENTE os dispositivos fornecidos entre <dispositivos>. Não use memória, não cite norma, julgado ou número que não esteja ali.
2. Toda frase com conteúdo jurídico termina com a marca do dispositivo que a sustenta, como [D1] ou [D2][D3].
3. Para cada marca usada, inclua em "citacoes" um trecho copiado LITERALMENTE do texto do dispositivo (ao menos uma oração completa), sem reescrever, resumir ou corrigir.
4. Se os dispositivos não bastarem para responder, devolva "semBase": true e explique em um parágrafo o que faltou, sem marcas.
5. Não dê conselho definitivo nem prometa resultado: a decisão é do advogado.

Formato da resposta (JSON):
{"paragrafos": ["... [D1].", "... [D2]."], "citacoes": [{"ref": "D1", "trecho": "texto literal"}], "semBase": false}`;

export function montarMensagem(pergunta: string, dataReferencia: string, trechos: Trecho[]): string {
  const blocos = trechos
    .map(
      (t) =>
        `<dispositivo ref="${t.ref}" norma="${t.norma}" rotulo="${t.rotulo}" vigencia="${t.vigenciaInicio}${t.vigenciaFim ? ` a ${t.vigenciaFim}` : ""}">\n${t.texto}\n</dispositivo>`,
    )
    .join("\n");
  return `Data de referência: ${dataReferencia} (considere o que estava vigente nessa data).

<dispositivos>
${blocos}
</dispositivos>

<pergunta>
${pergunta}
</pergunta>`;
}

/** Lê o JSON do modelo com tolerância a cercas de código; falha de formato vira bloqueio. */
export function lerResposta(texto: string): RespostaModelo | null {
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) return null;
  try {
    const j = JSON.parse(texto.slice(ini, fim + 1));
    if (!Array.isArray(j.paragrafos) || !Array.isArray(j.citacoes)) return null;
    return {
      paragrafos: j.paragrafos.filter((p: unknown) => typeof p === "string"),
      citacoes: j.citacoes
        .filter((c: any) => c && typeof c.ref === "string" && typeof c.trecho === "string")
        .map((c: any) => ({ ref: c.ref, trecho: c.trecho })),
      semBase: j.semBase === true,
    };
  } catch {
    return null;
  }
}

/**
 * Trecho inicial literal do dispositivo: inteiro se for curto; senão, as primeiras
 * orações até ~300 caracteres. Não corta depois de abreviações como "art." ou "n.".
 */
export function trechoInicial(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= 450) return limpo;
  const fim = /(?<!\b(?:arts?|n|inc|al|p|ns|fls?))[.;:](?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ§])/g;
  let corte = -1;
  for (const m of limpo.matchAll(fim)) {
    corte = m.index + 1;
    if (corte >= 200) break;
  }
  if (corte > 0 && corte <= 600) return limpo.slice(0, corte);
  return limpo.slice(0, 420).replace(/\s+\S*$/, "");
}

/**
 * Sem modelo de linguagem: devolve os dispositivos mais aderentes à pergunta, cada um
 * com seu trecho inicial literal. Só entra quem chega perto do melhor (80% da aderência
 * dele): citar o quarto colocado como "resposta" é citar norma que não responde.
 * Passa pelo mesmo verificador que a resposta redigida.
 */
export function respostaExtrativa(trechos: Trecho[], max = 3): RespostaModelo {
  const melhor = trechos[0]?.aderencia;
  const usados = (melhor === undefined ? trechos.slice(0, 1) : trechos.filter((t) => (t.aderencia ?? 0) >= melhor * 0.8)).slice(0, max);
  return {
    paragrafos: usados.map((t) => `${t.norma}, ${t.rotulo}: “${trechoInicial(t.texto)}” [${t.ref}]`),
    citacoes: usados.map((t) => ({ ref: t.ref, trecho: trechoInicial(t.texto) })),
  };
}
