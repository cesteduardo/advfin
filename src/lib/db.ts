import "server-only";
import { Pool, type PoolClient } from "pg";

/**
 * Conexão única do servidor. DATABASE_URL deve usar um login que herde app_user
 * (nunca o dono das tabelas), para que o RLS valha em toda consulta.
 */
let pool: Pool | null = null;

export function bancoConfigurado(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function obterPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente: o app precisa de PostgreSQL");
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DATABASE_POOL ?? 5) });
  return pool;
}

/** Consulta sem contexto de escritório (funções de login e base normativa pública). */
export async function consultar<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await obterPool().query(sql, params);
  return r.rows as T[];
}

export interface Contexto {
  usuarioId: string;
  escritorioId: string;
}

/** Executa fn numa transação com o contexto do escritório; o RLS isola o resto. */
export async function noEscritorio<T>(ctx: Contexto, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await obterPool().connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.escritorio_id', $1, true), set_config('app.usuario_id', $2, true)", [
      ctx.escritorioId,
      ctx.usuarioId,
    ]);
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
