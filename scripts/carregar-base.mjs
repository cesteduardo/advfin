#!/usr/bin/env node
/**
 * Carregador único do vade-mécum tributário. Lê o catálogo (scripts/catalogo-normas.mjs),
 * baixa ou abre cada norma, separa por artigo e põe tudo na fila do curador (em revisão).
 *
 *   node scripts/carregar-base.mjs --grupo federal --simular            só lê e mostra
 *   ADMIN_DATABASE_URL="..." node scripts/carregar-base.mjs --grupo federal
 *   ADMIN_DATABASE_URL="..." node scripts/carregar-base.mjs --grupo sp --pasta ~/Downloads/sp
 *   ADMIN_DATABASE_URL="..." node scripts/carregar-base.mjs --grupo solucoes --pasta ~/Downloads/solucoes
 *
 * Grupos: reforma, federal, receita, sp, solucoes, todas.
 * Normas com URL oficial (Planalto) são baixadas; as que só têm portal exigem a página salva
 * em --pasta com o nome do catálogo. Uma norma que falha é relatada e as outras seguem.
 * Pode rodar de novo: o que não mudou é ignorado; redação nova vira versão nova na fila.
 *
 * Soluções de consulta: uma página salva por solução, com o nome no formato
 * sc-cosit-99-2023.html (órgão, número, ano). Cada uma entra pela ementa.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import pg from "pg";
import { CATALOGO, GRUPOS } from "./catalogo-normas.mjs";
import { ingerirNorma, lerNorma } from "./ingestao.mjs";
import { baixar, decodificar } from "./planalto.mjs";

const SIJUT = "https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action";

/** sc-cosit-99-2023.html → meta de solução de consulta; null se o nome não segue o padrão. */
export function metaDaSolucao(arquivo) {
  const m = /^sc-([a-z0-9]+)-(\d+)-(\d{4})\.html?$/i.exec(arquivo);
  if (!m) return null;
  const [, orgao, numero, ano] = m;
  const sigla = orgao.toUpperCase();
  return {
    grupo: "solucoes", arquivo, modo: "documento",
    tipo: "SOLUCAO_CONSULTA", numero: `${sigla}-${Number(numero)}`, ano, publicada: `${ano}-01-01`,
    apelido: `Solução de Consulta ${sigla} ${Number(numero)}/${ano}`,
    ementa: `Solução de Consulta ${sigla} nº ${Number(numero)}/${ano}.`,
    portal: SIJUT,
  };
}

/** Quais normas um grupo carrega; para "solucoes", lê a pasta. */
export async function normasDoGrupo(grupo, pasta) {
  if (grupo === "solucoes" || grupo === "todas") {
    const doCatalogo = grupo === "todas" ? CATALOGO : [];
    if (!pasta) return { normas: doCatalogo, ignorados: grupo === "solucoes" ? ["(sem --pasta)"] : [] };
    let arquivos = [];
    try { arquivos = await readdir(pasta); } catch { arquivos = []; }
    const solucoes = arquivos.map(metaDaSolucao).filter(Boolean);
    const ignorados = grupo === "solucoes" ? arquivos.filter((f) => /\.html?$/i.test(f) && !metaDaSolucao(f)) : [];
    return { normas: [...doCatalogo, ...solucoes], ignorados };
  }
  return { normas: CATALOGO.filter((n) => n.grupo === grupo), ignorados: [] };
}

async function abrir(n, pasta) {
  if (pasta) {
    try {
      return decodificar(new Uint8Array(await readFile(join(pasta, n.arquivo))));
    } catch {
      if (!n.url) throw new Error(`arquivo ${n.arquivo} não está em ${pasta}`);
    }
  }
  if (!n.url) throw new Error(`sem URL estável: salve a página de ${n.portal} como ${n.arquivo} e rode com --pasta`);
  return baixar(n.url);
}

async function principal() {
  const { values: a } = parseArgs({
    options: {
      grupo: { type: "string", default: "reforma" },
      pasta: { type: "string" },
      simular: { type: "boolean", default: false },
    },
  });
  if (a.grupo !== "todas" && !GRUPOS[a.grupo]) {
    console.error(`Grupo desconhecido: ${a.grupo}. Use: ${[...Object.keys(GRUPOS), "todas"].join(", ")}.`);
    process.exit(1);
  }
  const { normas, ignorados } = await normasDoGrupo(a.grupo, a.pasta);
  console.log(`Grupo ${a.grupo}: ${a.grupo === "todas" ? "todo o catálogo" : GRUPOS[a.grupo]}. ${normas.length} normas.`);
  if (ignorados.length) console.log(`  arquivos fora do padrão sc-orgao-numero-ano.html, ignorados: ${ignorados.join(", ")}`);

  const lidas = [];
  const falhas = [];
  for (const n of normas) {
    const nome = n.apelido ?? `${n.tipo} ${n.numero}/${n.ano}`;
    process.stdout.write(`Lendo ${nome}… `);
    try {
      const html = await abrir(n, a.pasta);
      const { lista, vigencia } = lerNorma(html, n);
      if (lista.length === 0) throw new Error("nenhum artigo lido: a página mudou ou não é o texto da norma");
      console.log(`${lista.length} ${n.modo === "documento" ? "ementa" : "artigos"}${vigencia ? `; vigência no ${vigencia.rotulo}` : ""}.`);
      lidas.push({ meta: n, html, lista });
    } catch (e) {
      console.log(`FALHOU: ${e.message}`);
      falhas.push({ nome, motivo: e.message, portal: n.portal ?? n.url });
    }
  }

  if (a.simular) {
    for (const p of lidas) {
      console.log(`\n${p.meta.apelido ?? `${p.meta.tipo} ${p.meta.numero}/${p.meta.ano}`}, primeiros rótulos:`);
      for (const x of p.lista.slice(0, 6)) console.log(`  ${x.rotulo}: ${x.texto.slice(0, 90)}…`);
    }
  } else if (lidas.length) {
    if (!process.env.ADMIN_DATABASE_URL) {
      console.error("\nDefina ADMIN_DATABASE_URL (connection string do Supabase, usuário postgres).");
      process.exit(1);
    }
    const url = process.env.ADMIN_DATABASE_URL;
    const db = new pg.Client({ connectionString: url, ssl: /supabase|pooler/.test(url) ? { rejectUnauthorized: false } : undefined });
    await db.connect();
    try {
      for (const p of lidas) {
        try {
          const r = await ingerirNorma(db, p.meta, p.html);
          console.log(`${r.norma}: ${r.novos} novos, ${r.versoesNovas} com redação nova, ${r.iguais} já iguais; ${r.sementesAposentadas} da semente aposentados.`);
        } catch (e) {
          falhas.push({ nome: p.meta.apelido ?? p.meta.numero, motivo: e.message });
          console.log(`${p.meta.apelido ?? p.meta.numero}: FALHOU ao gravar: ${e.message}`);
        }
      }
      const { rows: [f] } = await db.query(
        `select count(*) filter (where status_curadoria = 'em_revisao') fila, count(*) filter (where status_curadoria = 'publicado') publicados from dispositivos`,
      );
      console.log(`\nFila do curador: ${f.fila} dispositivos em revisão; ${f.publicados} publicados.`);
    } finally {
      await db.end();
    }
  }

  if (falhas.length) {
    console.log(`\n${falhas.length} norma(s) não carregada(s):`);
    for (const f of falhas) console.log(`  ${f.nome}: ${f.motivo}${f.portal ? ` (fonte: ${f.portal})` : ""}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await principal();
