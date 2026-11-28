#!/usr/bin/env node
/**
 * Base normativa da demonstração estática (GitHub Pages, sem banco).
 *
 * Lê as normas do catálogo (scripts/catalogo-normas.mjs) pelo mesmo leitor do carregador
 * do banco, separa por artigo e grava em public/base/:
 *   indice.json          lista das normas, das partes e um índice invertido pequeno
 *                        (radical → partes onde aparece), para o navegador baixar só o que a
 *                        pergunta precisa;
 *   <norma>-<n>.json     os artigos, em partes de até ~300 KB.
 *
 *   node scripts/gerar-base-estatica.mjs                      baixa do Planalto tudo o que tem URL
 *   node scripts/gerar-base-estatica.mjs --grupo apoio        só um grupo do catálogo
 *   node scripts/gerar-base-estatica.mjs --pasta ~/Downloads/normas   usa páginas salvas
 *
 * Regras de fidelidade (as mesmas do banco):
 *   - o texto é o literal da página oficial, sem paráfrase: só sai o que o Planalto mostra
 *     tachado (redação revogada) e as notas de alteração, guardadas à parte em "notas";
 *   - tudo entra como "em_revisao", isto é, não conferido pelo curador;
 *   - a vigência é provisória (data de publicação) até o curador datar cada versão.
 * Rodar de novo substitui as partes da norma lida e preserva as demais.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { CATALOGO, GRUPOS } from "./catalogo-normas.mjs";
import { abrir } from "./carregar-base.mjs";
import { lerNorma } from "./ingestao.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PASTA_BASE = join(RAIZ, "public", "base");
const LIMITE_PARTE = 300_000; // bytes de texto por arquivo

const NOME = { CF: "CF", EC: "EC", LC: "LC", LEI: "Lei", DECRETO: "Decreto", DECRETO_LEI: "Decreto-Lei" };

/** Mesma normalização de src/lib/pesquisa/verificador.ts (caixa, acentos, ordinais, travessões). */
export function normalizar(s) {
  return s
    .replace(/[“”«»"]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/[–—‑]/g, "-")
    .replace(/[º°]/g, "o")
    .replace(/ª/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Mesmos radicais de src/lib/pesquisa/termos.ts: palavra normalizada, cortada em 5 letras. */
export function radicais(texto) {
  const r = new Set();
  for (const p of normalizar(texto).split(/[^a-z0-9-]+/)) if (p.length >= 3) r.add(p.length > 5 ? p.slice(0, 5) : p);
  return r;
}

export const idDaNorma = (n) => `${n.ente && n.ente !== "BR" ? `${n.ente.toLowerCase()}-` : ""}${n.tipo.toLowerCase()}-${String(n.numero).toLowerCase()}-${n.ano}`.replace(/[^a-z0-9-]+/g, "-");
export const nomeDaNorma = (n) => n.apelido ?? `${NOME[n.tipo] ?? n.tipo} ${n.numero}/${n.ano}`;
const slug = (s) => normalizar(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Artigos lidos → dispositivos da demonstração, divididos em partes. */
export function montarNorma(meta, lista) {
  const id = idDaNorma(meta);
  const vistos = new Map();
  for (const a of lista) if (!a.introducao) vistos.set(a.rotulo, a); // rótulo repetido: fica a última redação
  const dispositivos = [...vistos.values()].map((a) => ({
    id: `${id}-${slug(a.rotulo)}`,
    rotulo: a.rotulo,
    texto: a.texto,
    ...(a.notas?.length ? { notas: a.notas } : {}),
  }));
  const partes = [];
  let atual = [];
  let tamanho = 0;
  for (const d of dispositivos) {
    const t = d.texto.length + d.rotulo.length + 60;
    if (atual.length && tamanho + t > LIMITE_PARTE) {
      partes.push(atual);
      atual = [];
      tamanho = 0;
    }
    atual.push(d);
    tamanho += t;
  }
  if (atual.length) partes.push(atual);
  return { id, dispositivos, partes };
}

function metaPublica(meta, id, total, hash) {
  return {
    id,
    norma: nomeDaNorma(meta),
    tipo: meta.tipo,
    numero: meta.numero,
    ano: meta.ano,
    grupo: meta.grupo,
    esfera: meta.esfera ?? "federal",
    ente: meta.ente ?? "BR",
    ementa: meta.ementa,
    url: meta.url ?? meta.portal,
    vigenciaInicio: meta.publicada,
    vigenciaProvisoria: true,
    curadoria: "em_revisao",
    dispositivos: total,
    hash,
  };
}

/** Lê as partes existentes e refaz o índice invertido a partir delas. */
export async function reconstruirIndice(pasta = PASTA_BASE) {
  const normasArq = JSON.parse(await readFile(join(pasta, "normas.json"), "utf8").catch(() => "[]"));
  const partes = [];
  const termos = new Map();
  for (const n of normasArq) {
    for (let i = 0; i < n.partes; i++) {
      const arquivo = `${n.id}-${i + 1}.json`;
      const conteudo = JSON.parse(await readFile(join(pasta, arquivo), "utf8"));
      const idx = partes.length;
      partes.push({ arquivo, norma: n.id, dispositivos: conteudo.dispositivos.length });
      const vistos = new Set();
      for (const d of conteudo.dispositivos) for (const r of radicais(`${d.rotulo} ${d.texto}`)) vistos.add(r);
      for (const r of vistos) {
        if (!termos.has(r)) termos.set(r, []);
        termos.get(r).push(idx);
      }
    }
  }
  // Radicais que aparecem em quase todas as partes não ajudam a escolher: ficam de fora.
  const corte = Math.max(4, Math.ceil(partes.length * 0.8));
  const indice = {};
  for (const [r, ps] of [...termos.entries()].sort()) if (ps.length < corte || partes.length < 4) indice[r] = ps;
  const saida = {
    versao: 1,
    geradoEm: new Date().toISOString().slice(0, 10),
    aviso: "Texto literal das páginas oficiais, não conferido pelo curador. Vigência provisória: data de publicação.",
    normas: normasArq.map(({ partes: _p, ...resto }) => resto),
    partes,
    termos: indice,
  };
  await writeFile(join(pasta, "indice.json"), JSON.stringify(saida));
  return saida;
}

async function principal() {
  const { values: a } = parseArgs({ options: { grupo: { type: "string", default: "todas" }, pasta: { type: "string" } } });
  const grupos = a.grupo === "todas" ? ["reforma", "federal", "apoio"] : a.grupo.split(",");
  for (const g of grupos) if (!GRUPOS[g]) throw new Error(`Grupo desconhecido: ${g}. Use: ${Object.keys(GRUPOS).join(", ")}, todas.`);
  const normas = CATALOGO.filter((n) => grupos.includes(n.grupo) && (n.url || a.pasta));
  await mkdir(PASTA_BASE, { recursive: true });
  const registro = JSON.parse(await readFile(join(PASTA_BASE, "normas.json"), "utf8").catch(() => "[]"));
  const porId = new Map(registro.map((n) => [n.id, n]));
  const paginas = new Map(); // CF e ADCT vêm da mesma página: baixa uma vez
  const falhas = [];
  for (const meta of normas) {
    const nome = nomeDaNorma(meta);
    process.stdout.write(`Lendo ${nome}… `);
    try {
      const chave = meta.url ?? meta.pagina ?? meta.arquivo;
      if (!paginas.has(chave)) paginas.set(chave, await abrir(meta, a.pasta));
      const { lista } = lerNorma(paginas.get(chave), meta);
      if (lista.length === 0) throw new Error("nenhum artigo lido: a página mudou ou não é o texto da norma");
      const { id, dispositivos, partes } = montarNorma(meta, lista);
      const antiga = porId.get(id);
      if (antiga) for (let i = 0; i < antiga.partes; i++) await rm(join(PASTA_BASE, `${id}-${i + 1}.json`), { force: true });
      const hash = createHash("sha256").update(JSON.stringify(dispositivos)).digest("hex").slice(0, 12);
      for (const [i, p] of partes.entries()) await writeFile(join(PASTA_BASE, `${id}-${i + 1}.json`), JSON.stringify({ norma: id, dispositivos: p }));
      porId.set(id, { ...metaPublica(meta, id, dispositivos.length, hash), partes: partes.length });
      console.log(`${dispositivos.length} dispositivos em ${partes.length} arquivo(s).`);
    } catch (e) {
      console.log(`FALHOU: ${e.message}`);
      falhas.push(`${nome}: ${e.message}`);
    }
  }
  const ordem = new Map(CATALOGO.map((n, i) => [idDaNorma(n), i]));
  const lista = [...porId.values()].sort((x, y) => (ordem.get(x.id) ?? 999) - (ordem.get(y.id) ?? 999));
  await writeFile(join(PASTA_BASE, "normas.json"), JSON.stringify(lista, null, 1));
  const indice = await reconstruirIndice();
  const arquivos = (await readdir(PASTA_BASE)).length;
  console.log(`\nBase estática: ${indice.normas.length} normas, ${indice.normas.reduce((s, n) => s + n.dispositivos, 0)} dispositivos, ${arquivos} arquivos em public/base/.`);
  if (falhas.length) {
    console.log(`\n${falhas.length} norma(s) não lida(s):\n  ${falhas.join("\n  ")}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await principal();
