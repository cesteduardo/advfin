import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import { Pool } from "pg";

export interface Inscricao {
  nome: string;
  email: string;
  perfil: string;
  consentimento: true;
  origem?: string;
}

let pool: Pool | null = null;

/**
 * Com DATABASE_URL: grava em lista_espera (idempotente por e-mail).
 * Sem banco (desenvolvimento): grava em data/lista-espera.jsonl.
 */
export async function registrarInscricao(i: Inscricao): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (url) {
    pool ??= new Pool({ connectionString: url, max: 3 });
    await pool.query(
      `insert into lista_espera (email, nome, perfil, consentimento_em, origem)
       values ($1, $2, $3, now(), $4)
       on conflict (email) do nothing`,
      [i.email, i.nome, i.perfil, i.origem ?? null],
    );
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL ausente em produção");
  await mkdir("data", { recursive: true });
  await appendFile("data/lista-espera.jsonl", JSON.stringify({ ...i, em: new Date().toISOString() }) + "\n");
}
