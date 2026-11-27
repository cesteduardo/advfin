/**
 * Siglas que o texto constitucional não usa ("CBS" aparece como "art. 195, V").
 * A busca acrescenta à pergunta o número do dispositivo que institui cada tributo,
 * para que o Postgres ache o artigo mesmo quando a pergunta só traz a sigla.
 */
import type { Trecho } from "./tipos";
import { normalizar } from "./verificador";

export const SINONIMOS: Record<string, string[]> = {
  cbs: ["195", "contribuicao"],
  ibs: ["156-a", "imposto"],
  icms: ["155"],
  iss: ["156"],
  pis: ["239", "195"],
  cofins: ["195"],
  seletivo: ["153"],
};

/** Para a busca do banco: a pergunta original seguida dos números dos dispositivos. */
export function expandirPergunta(pergunta: string): string {
  const palavras = new Set(normalizar(pergunta).split(/[^a-z0-9-]+/));
  const extra = new Set<string>();
  for (const [sigla, alvos] of Object.entries(SINONIMOS)) {
    if (palavras.has(sigla)) for (const a of alvos) extra.add(a.replace(/-a$/, ""));
  }
  return extra.size ? `${pergunta} ${[...extra].join(" ")}` : pergunta;
}

const VAZIAS = new Set(
  "a o as os de da do das dos e em no na nos nas um uma para por com que qual quais quando como se sao ser sera ao aos ou the ha esta estao fica ficam pode podem tem sobre partir ainda depois antes ano anos".split(" "),
);

export const radical = (t: string) => (t.length > 5 ? t.slice(0, 5) : t);

/** Palavras com conteúdo da pergunta, em radical curto ("alíquotas" → "aliqu"). */
export function termosDaPergunta(pergunta: string): string[] {
  const brutos = normalizar(pergunta)
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length >= 3 && !VAZIAS.has(t));
  return [...new Set(brutos)];
}

export function palavrasDoTrecho(t: Pick<Trecho, "rotulo" | "texto">): Set<string> {
  return new Set(normalizar(`${t.rotulo} ${t.texto}`).split(/[^a-z0-9-]+/).map(radical));
}

/**
 * Aderência: fração das palavras da pergunta que o dispositivo contém (a sigla vale
 * pelo número do dispositivo que a institui). 1 = todas; 0 = nenhuma.
 */
export function aderencia(pergunta: string, t: Pick<Trecho, "rotulo" | "texto">): number {
  const ts = termosDaPergunta(pergunta);
  if (ts.length === 0) return 0;
  const palavras = palavrasDoTrecho(t);
  const ok = ts.filter((x) => [x, ...(SINONIMOS[x] ?? [])].some((y) => palavras.has(radical(y))));
  return ok.length / ts.length;
}

/** Abaixo disso o dispositivo fala de outra coisa: não vai ao modelo nem à tela. */
export const ADERENCIA_MINIMA = 0.34;

/**
 * Depois da busca: descarta o que mal toca a pergunta, ordena pela aderência (empate
 * mantém a ordem da busca) e renumera D1, D2… Sem nada aderente, a pesquisa diz que a
 * base não cobre o tema, em vez de citar norma que não responde.
 */
export function selecionarFontes(pergunta: string, fontes: Trecho[], minimo = ADERENCIA_MINIMA): Trecho[] {
  return fontes
    .map((t, i) => ({ t, i, a: aderencia(pergunta, t) }))
    .filter((x) => x.a >= minimo)
    .sort((x, y) => y.a - x.a || x.i - y.i)
    .map(({ t, a }, i) => ({ ...t, ref: `D${i + 1}`, aderencia: Math.round(a * 100) / 100 }));
}
