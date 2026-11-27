#!/usr/bin/env node
/**
 * Expurgo diário (LGPD): anonimiza contas excluídas há até 15 dias, apaga escritórios encerrados
 * há mais de 30 dias e limpa sessões, desafios e trocas de e-mail vencidos.
 * Roda como dono das tabelas (o app_user não tem permissão para isto):
 *   ADMIN_DATABASE_URL=postgres://... node scripts/expurgo.mjs
 * Agende uma vez por dia (cron do servidor, Supabase pg_cron ou Vercel Cron chamando um job).
 */
import pg from "pg";

const url = process.env.ADMIN_DATABASE_URL;
if (!url) {
  console.error("Defina ADMIN_DATABASE_URL (dono das tabelas).");
  process.exit(1);
}
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  const { rows } = await c.query("select app.expurgar() r");
  // Registro de erros (90 dias) e comentários de relatos já decididos (180 dias), desde a migração 004.
  const { rows: [temRegistros] } = await c.query("select to_regprocedure('app.expurgar_registros()') is not null ok");
  const extra = temRegistros.ok ? (await c.query("select app.expurgar_registros() r")).rows[0].r : {};
  console.log(new Date().toISOString(), JSON.stringify({ ...rows[0].r, ...extra }));
} finally {
  await c.end();
}
