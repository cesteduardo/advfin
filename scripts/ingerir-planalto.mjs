#!/usr/bin/env node
/**
 * Ingestão de uma norma do Planalto na base versionada.
 *
 *   node scripts/ingerir-planalto.mjs --tipo LC --numero 214 --ano 2025 \
 *     --publicada 2025-01-16 --ementa "Institui o IBS, a CBS e o IS" \
 *     --url https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm [--arquivo lcp214.htm]
 *
 * Sem --arquivo, baixa a URL. Cada artigo entra como status 'rascunho',
 * origem 'ingestao', vigência a partir da publicação. Nada chega ao advogado
 * em produção antes de o curador revisar e publicar.
 *
 * Variável: ADMIN_DATABASE_URL (dono das tabelas; app_user não grava na base normativa).
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import pg from "pg";
import { artigos, decodificar, textoLimpo } from "./planalto.mjs";

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

let html;
if (a.arquivo) {
  html = decodificar(new Uint8Array(await readFile(a.arquivo)));
} else {
  const r = await fetch(a.url, { headers: { "user-agent": "advfin-ingestao/1.0" } });
  if (!r.ok) { console.error(`download falhou: ${r.status}`); process.exit(1); }
  html = decodificar(new Uint8Array(await r.arrayBuffer()), r.headers.get("content-type") ?? "");
}

const lista = artigos(textoLimpo(html));
console.log(`${lista.length} artigos lidos de ${a.tipo} ${a.numero}/${a.ano}`);
if (a.simular) {
  for (const x of lista.slice(0, 5)) console.log(`- ${x.rotulo}: ${x.texto.slice(0, 120)}…`);
  process.exit(0);
}

const db = new pg.Client({ connectionString: process.env.ADMIN_DATABASE_URL });
await db.connect();
try {
  await db.query("begin");
  const { rows: [n] } = await db.query(
    `insert into normas (tipo, numero, ano, ementa, url_oficial, publicada_em) values ($1,$2,$3,$4,$5,$6)
     on conflict (tipo, numero, ano) do update set ementa = excluded.ementa, url_oficial = excluded.url_oficial
     returning id`,
    [a.tipo, a.numero, Number(a.ano), a.ementa, a.url, a.publicada],
  );
  let novos = 0;
  for (const x of lista) {
    // Mesma redação já carregada? Não duplica. Redação diferente entra como nova versão em rascunho.
    const { rowCount } = await db.query(
      `insert into dispositivos (norma_id, rotulo, texto, vigencia_inicio, status_curadoria, origem)
       select $1, $2, $3, $4, 'rascunho', 'ingestao'
       where not exists (select 1 from dispositivos where norma_id = $1 and rotulo = $2 and texto = $3)`,
      [n.id, x.rotulo, x.texto, a.publicada],
    );
    novos += rowCount;
  }
  await db.query("commit");
  console.log(`${novos} dispositivos novos em rascunho, aguardando o curador.`);
} catch (e) {
  await db.query("rollback");
  throw e;
} finally {
  await db.end();
}
