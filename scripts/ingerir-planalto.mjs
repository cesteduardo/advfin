#!/usr/bin/env node
/**
 * Ingestão de UMA norma do Planalto na base versionada. Para a Reforma inteira
 * (EC 132/2023 e LC 214/2025 de uma vez), use scripts/carregar-reforma.mjs.
 *
 *   node scripts/ingerir-planalto.mjs --tipo LC --numero 214 --ano 2025 \
 *     --publicada 2025-01-16 --ementa "Institui o IBS, a CBS e o IS" \
 *     --url https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm [--arquivo lcp214.htm] [--simular]
 *
 * Sem --arquivo, baixa a URL. Regras de gravação em scripts/ingestao.mjs.
 * Variável: ADMIN_DATABASE_URL (dono das tabelas; app_user não grava na base normativa).
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import pg from "pg";
import { ingerirNorma, lerNorma } from "./ingestao.mjs";
import { baixar, decodificar } from "./planalto.mjs";

const { values: a } = parseArgs({
  options: {
    tipo: { type: "string" }, numero: { type: "string" }, ano: { type: "string" },
    publicada: { type: "string" }, ementa: { type: "string" }, url: { type: "string" },
    arquivo: { type: "string" }, simular: { type: "boolean", default: false },
  },
});
for (const k of ["tipo", "numero", "ano", "publicada", "ementa", "url"]) {
  if (!a[k]) { console.error(`faltou --${k}`); process.exit(2); }
}

const html = a.arquivo ? decodificar(new Uint8Array(await readFile(a.arquivo))) : await baixar(a.url);

if (a.simular) {
  const { lista, vigencia } = lerNorma(html);
  console.log(`${lista.length} artigos lidos de ${a.tipo} ${a.numero}/${a.ano}; vigência em ${vigencia?.rotulo ?? "?"}`);
  for (const x of lista.slice(0, 8)) console.log(`- ${x.rotulo}: ${x.texto.slice(0, 110)}…`);
  process.exit(0);
}

const db = new pg.Client({ connectionString: process.env.ADMIN_DATABASE_URL });
await db.connect();
try {
  const r = await ingerirNorma(db, { ...a }, html);
  console.log(`${r.norma}: ${r.lidos} artigos lidos, ${r.novos} novos, ${r.versoesNovas} com redação nova, ${r.iguais} já iguais; ${r.sementesAposentadas} linhas da semente aposentadas.`);
} finally {
  await db.end();
}
