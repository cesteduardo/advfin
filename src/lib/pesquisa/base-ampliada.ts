/**
 * Base ampliada da demonstração estática: as normas do catálogo, lidas do texto oficial
 * por scripts/gerar-base-estatica.mjs e servidas em /base (public/base).
 *
 * O navegador baixa primeiro o índice (lista de normas e radical → partes) e, a cada
 * pergunta, só as partes onde os termos aparecem. Cada parte baixada fica em memória.
 * Tudo entra como "em_revisao" (não conferido pelo curador), com vigência provisória.
 * Sem índice publicado (ou sem rede), a busca segue só com a base embutida.
 */
import { BASE_LOCAL, recuperarLocal } from "./base-local";
import { SINONIMOS, palavrasDoTrecho, radical, selecionarFontes, termosDaPergunta } from "./termos";
import type { Trecho } from "./tipos";

export interface NormaAmpliada {
  id: string;
  norma: string;
  ementa: string;
  url: string;
  grupo: string;
  vigenciaInicio: string;
  dispositivos: number;
}

export interface IndiceAmpliado {
  versao: number;
  geradoEm: string;
  normas: NormaAmpliada[];
  partes: { arquivo: string; norma: string; dispositivos: number }[];
  termos: Record<string, number[]>;
}

interface DispositivoAmpliado {
  id: string;
  rotulo: string;
  texto: string;
}

const prefixo = () => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/base`;

let indice: Promise<IndiceAmpliado | null> | null = null;
const partes = new Map<string, Promise<DispositivoAmpliado[]>>();

export function carregarIndice(buscar: typeof fetch = fetch): Promise<IndiceAmpliado | null> {
  indice ??= buscar(`${prefixo()}/indice.json`)
    .then((r) => (r.ok ? (r.json() as Promise<IndiceAmpliado>) : null))
    .catch(() => null)
    .then((i) => {
      if (!i) indice = null; // tenta de novo na próxima pergunta
      return i;
    });
  return indice;
}

function carregarParte(arquivo: string, buscar: typeof fetch): Promise<DispositivoAmpliado[]> {
  let p = partes.get(arquivo);
  if (!p) {
    p = buscar(`${prefixo()}/${arquivo}`)
      .then((r) => (r.ok ? r.json() : { dispositivos: [] }))
      .then((j: { dispositivos: DispositivoAmpliado[] }) => j.dispositivos)
      .catch(() => {
        partes.delete(arquivo);
        return [];
      });
    partes.set(arquivo, p);
  }
  return p;
}

/** Radicais da pergunta, com as siglas expandidas (CBS → 195), como na base embutida. */
function radicaisDaPergunta(pergunta: string): string[] {
  return [...new Set(termosDaPergunta(pergunta).flatMap((t) => [t, ...(SINONIMOS[t] ?? [])]).map(radical))];
}

/** As partes que mais termos da pergunta contêm (no máximo `maximo`). */
export function escolherPartes(ix: IndiceAmpliado, pergunta: string, maximo = 4): number[] {
  const nota = new Map<number, number>();
  for (const r of radicaisDaPergunta(pergunta)) for (const p of ix.termos[r] ?? []) nota.set(p, (nota.get(p) ?? 0) + 1);
  const melhor = Math.max(0, ...nota.values());
  if (melhor === 0) return [];
  return [...nota.entries()]
    .filter(([, n]) => n >= Math.max(1, melhor - 1))
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, maximo)
    .map(([p]) => p);
}

/**
 * Recuperação na base embutida mais a ampliada. Quando uma norma da base embutida também
 * veio da ampliada (EC 132, LC 214), vale a ampliada, que é o texto lido da página oficial.
 */
export async function recuperarAmpliada(pergunta: string, data: string, limite = 6, buscar: typeof fetch = fetch): Promise<Trecho[]> {
  const ix = await carregarIndice(buscar);
  if (!ix) return recuperarLocal(pergunta, data, limite);
  const ts = radicaisDaPergunta(pergunta);
  if (ts.length === 0) return [];
  const escolhidas = escolherPartes(ix, pergunta);
  const normas = new Map(ix.normas.map((n) => [n.id, n]));
  const candidatos: Omit<Trecho, "ref">[] = [];
  const nomesAmpliados = new Set<string>();
  const lidas = await Promise.all(escolhidas.map((i) => carregarParte(ix.partes[i].arquivo, buscar).then((ds) => ({ ds, n: normas.get(ix.partes[i].norma) }))));
  for (const { ds, n } of lidas) {
    if (!n || n.vigenciaInicio > data) continue;
    nomesAmpliados.add(n.norma);
    for (const d of ds) {
      candidatos.push({ id: d.id, norma: n.norma, ementa: n.ementa, url: n.url, rotulo: d.rotulo, texto: d.texto, vigenciaInicio: n.vigenciaInicio, vigenciaFim: null, curadoria: "em_revisao", origem: "ingestao" });
    }
  }
  const ampliadas = new Set(ix.normas.map((n) => n.norma));
  for (const d of BASE_LOCAL) {
    if (ampliadas.has(d.norma) && nomesAmpliados.has(d.norma)) continue;
    if (d.vigenciaInicio <= data && (!d.vigenciaFim || d.vigenciaFim >= data)) candidatos.push({ ...d, curadoria: "em_revisao", origem: "semente" });
  }
  const achados = candidatos
    .map((d) => {
      const palavras = palavrasDoTrecho(d);
      return { d, nota: ts.filter((t) => palavras.has(t)).length };
    })
    .filter((x) => x.nota > 0)
    .sort((a, b) => b.nota - a.nota || a.d.texto.length - b.d.texto.length)
    .slice(0, limite)
    .map(({ d }, i): Trecho => ({ ...d, ref: `D${i + 1}` }));
  return selecionarFontes(pergunta, achados);
}

/** Só para testes: esquece índice e partes já baixados. */
export function _limparCache() {
  indice = null;
  partes.clear();
}
