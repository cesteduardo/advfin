#!/usr/bin/env node
/**
 * Carrega o núcleo da Reforma Tributária na base, com o texto oficial do Planalto:
 * EC 132/2023 e LC 214/2025. Tudo entra na fila do curador (em revisão), e a semente
 * provisória dos mesmos artigos sai da pesquisa.
 *
 *   ADMIN_DATABASE_URL="postgres://..." node scripts/carregar-reforma.mjs
 *   ADMIN_DATABASE_URL="postgres://..." node scripts/carregar-reforma.mjs --pasta ~/Downloads   (páginas salvas)
 *   node scripts/carregar-reforma.mjs --simular                                                 (só lê e mostra)
 *
 * Com --pasta, procura emc132.htm e lcp214.htm na pasta (salve com "Salvar como… página HTML").
 * Pode rodar de novo sempre que o Planalto atualizar o texto compilado: o que não mudou é ignorado.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import pg from "pg";
import { ingerirNorma, lerNorma } from "./ingestao.mjs";
import { baixar, decodificar } from "./planalto.mjs";

export const NORMAS_REFORMA = [
  {
    arquivo: "emc132.htm",
    tipo: "EC", numero: "132", ano: "2023", publicada: "2023-12-21",
    ementa: "Altera o Sistema Tributário Nacional (Reforma Tributária do consumo).",
    url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm",
  },
  {
    arquivo: "lcp214.htm",
    tipo: "LC", numero: "214", ano: "2025", publicada: "2025-01-16",
    ementa: "Institui o Imposto sobre Bens e Serviços (IBS), a Contribuição Social sobre Bens e Serviços (CBS) e o Imposto Seletivo (IS).",
    url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm",
  },
];

const { values: a } = parseArgs({ options: { pasta: { type: "string" }, simular: { type: "boolean", default: false } } });

const paginas = [];
for (const n of NORMAS_REFORMA) {
  process.stdout.write(`Lendo ${n.tipo} ${n.numero}/${n.ano}… `);
  const html = a.pasta ? decodificar(new Uint8Array(await readFile(join(a.pasta, n.arquivo)))) : await baixar(n.url);
  const { lista, vigencia } = lerNorma(html);
  const citados = lista.filter((x) => x.citado);
  console.log(`${lista.length} artigos (${citados.length} inseridos em outras normas); vigência no ${vigencia?.rotulo ?? "?"}.`);
  const semDestino = citados.filter((x) => !x.destino).length;
  if (semDestino) console.log(`  atenção: ${semDestino} artigos entre aspas sem norma de destino reconhecida (rótulo "alteração, art. N").`);
  paginas.push({ meta: n, html, lista });
}

if (a.simular) {
  for (const p of paginas) {
    console.log(`\n${p.meta.tipo} ${p.meta.numero}/${p.meta.ano}, primeiros rótulos:`);
    for (const x of p.lista.slice(0, 12)) console.log(`  ${x.rotulo}: ${x.texto.slice(0, 90)}…`);
  }
  process.exit(0);
}

if (!process.env.ADMIN_DATABASE_URL) {
  console.error("\nDefina ADMIN_DATABASE_URL (connection string do Supabase, usuário postgres).");
  process.exit(1);
}
const db = new pg.Client({ connectionString: process.env.ADMIN_DATABASE_URL, ssl: /supabase|pooler/.test(process.env.ADMIN_DATABASE_URL) ? { rejectUnauthorized: false } : undefined });
await db.connect();
try {
  for (const p of paginas) {
    const r = await ingerirNorma(db, p.meta, p.html);
    console.log(`${r.norma}: ${r.novos} novos, ${r.versoesNovas} com redação nova, ${r.iguais} já iguais; ${r.sementesAposentadas} linhas da semente aposentadas.`);
  }
  const { rows: [f] } = await db.query(`select count(*) filter (where status_curadoria = 'em_revisao') fila, count(*) filter (where status_curadoria = 'publicado') publicados from dispositivos`);
  console.log(`\nPronto. Fila do curador: ${f.fila} dispositivos em revisão; ${f.publicados} já publicados.`);
  console.log("Próximo passo: o curador abre /admin → Curadoria, confere cada artigo com o Planalto e publica.");
} finally {
  await db.end();
}
