"use client";

/**
 * Revisão do texto ditado: o reconhecimento de voz devolve palavras soltas, sem pontuação
 * e às vezes sem acento. Aqui ele ganha maiúsculas, pontuação, siglas tributárias certas e,
 * com o corretor do Escritor (Hunspell + dicionário VERO, em public/orto), os acentos
 * que faltaram. A revisão pelo modelo conectado, quando houver, vem depois disto.
 */

const base = () => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/orto`;

/** Pontuação falada ("vírgula", "ponto de interrogação") vira sinal. */
const FALADA: [RegExp, string][] = [
  [/\s*\bponto de interroga[çc][ãa]o\b/gi, "?"],
  [/\s*\bponto de exclama[çc][ãa]o\b/gi, "!"],
  [/\s*\b(ponto final|ponto parágrafo|ponto paragrafo)\b/gi, "."],
  [/\s*\bdois pontos\b/gi, ":"],
  [/\s*\bponto e v[íi]rgula\b/gi, ";"],
  [/\s*\bv[íi]rgula\b/gi, ","],
  [/\s*\bnova linha\b/gi, "\n"],
];

const SIGLAS = ["IBS", "CBS", "ICMS", "ISS", "ISSQN", "PIS", "Cofins", "IPI", "IOF", "IRPJ", "CSLL", "IPTU", "IPVA", "ITCMD", "ITBI", "EC", "LC", "ADCT", "CF", "STF", "STJ", "CARF", "NCM", "NBS", "CNPJ", "CPF", "Simples", "Receita"];
const SIGLA = new Map(SIGLAS.map((s) => [s.toLowerCase(), s]));

const PERGUNTA = /^(você sabe|voce sabe|sabe|vocês|o que|que|qual|quais|quando|como|onde|aonde|quanto|quantos|quantas|quem|por que|porque|pra que|para que|será|sera|é possível|e possível|pode|posso|podemos|existe|existem|há|tem|devo|vale|e o|e a|e os|e as|e se)(?=[\s,.?!]|$)/i;

/** Regras rápidas, sem dicionário: pontuação falada, siglas, maiúsculas e o sinal do fim. */
export function pontuarLocal(texto: string): string {
  let t = texto.replace(/\s+/g, " ").trim();
  if (!t) return t;
  for (const [re, sinal] of FALADA) t = t.replace(re, sinal);
  t = t.replace(/\s+([,.;:?!])/g, "$1").replace(/([,.;:?!])(?=[^\s\d,.;:?!])/g, "$1 ");
  t = t.replace(/[\p{L}\d-]+/gu, (w) => SIGLA.get(w.toLowerCase()) ?? w);
  // Maiúscula no começo e depois de ponto final, interrogação e exclamação.
  t = t.replace(/(^|[.?!]\s+|\n\s*)(\p{Ll})/gu, (_, a: string, l: string) => a + l.toUpperCase());
  // O sinal do fim depende da última frase: "Obrigado." depois de um pedido não vira pergunta.
  const ultima = t.split(/[.?!]\s+/).at(-1) ?? t;
  if (!/[.?!…:]$/.test(t)) t += PERGUNTA.test(ultima) ? "?" : ".";
  // "Porque" que abre pergunta é "por que".
  t = t.replace(/^Porque\b(?=.*\?$)/, "Por que");
  return t;
}

type Resposta = { id?: number; erradas?: string[]; sugestoes?: string[]; pronto?: boolean; falhou?: string };

let worker: Worker | null = null;
let pronto: Promise<boolean> | null = null;
let seq = 0;
const espera = new Map<number, (r: Resposta) => void>();

function abrir(): Promise<boolean> {
  if (pronto) return pronto;
  pronto = new Promise((ok) => {
    try {
      worker = new Worker(`${base()}/orto-worker.js`);
    } catch {
      return ok(false);
    }
    worker.onmessage = (e: MessageEvent<Resposta>) => {
      const r = e.data;
      if (r.pronto) return ok(true);
      if (r.falhou) return ok(false);
      if (r.id !== undefined) {
        espera.get(r.id)?.(r);
        espera.delete(r.id);
      }
    };
    worker.onerror = () => ok(false);
  });
  return pronto;
}

const pedir = (msg: Record<string, unknown>) =>
  new Promise<Resposta>((ok) => {
    const id = ++seq;
    espera.set(id, ok);
    worker!.postMessage({ ...msg, id });
  });

/** Começa a carregar o dicionário (uns 5 MB, uma vez por visita) quando o microfone liga. */
export const prepararCorretor = () => void abrir();

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Acentos que faltaram ("voce" → "você", "aliquota" → "alíquota"). Só troca quando a sugestão
 * do dicionário é a mesma palavra com acento: nunca muda uma palavra por outra.
 */
export async function acentuar(texto: string, limiteMs = 2500): Promise<string> {
  const ok = await Promise.race([abrir(), new Promise<boolean>((r) => setTimeout(() => r(false), limiteMs))]);
  if (!ok || !worker) return texto;
  const palavras = [...new Set(texto.match(/\p{L}{3,}/gu) ?? [])].filter((w) => !SIGLA.has(w.toLowerCase()));
  if (!palavras.length) return texto;
  const { erradas = [] } = await pedir({ tipo: "checar", palavras });
  const trocas = new Map<string, string>();
  await Promise.all(
    erradas.slice(0, 25).map(async (w) => {
      const { sugestoes = [] } = await pedir({ tipo: "sugerir", palavra: w });
      const certa = sugestoes.find((s) => semAcento(s) === semAcento(w) && s !== w);
      if (certa) trocas.set(w, w[0] === w[0].toUpperCase() ? certa[0].toUpperCase() + certa.slice(1) : certa);
    }),
  );
  return trocas.size ? texto.replace(/\p{L}{3,}/gu, (w) => trocas.get(w) ?? w) : texto;
}

/** Revisão local completa: pontuação e maiúsculas, depois os acentos pelo dicionário. */
export async function revisarLocal(texto: string): Promise<string> {
  const pontuado = pontuarLocal(texto);
  try {
    return await acentuar(pontuado);
  } catch {
    return pontuado;
  }
}
