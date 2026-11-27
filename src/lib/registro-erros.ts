/**
 * Registro de erros do servidor no banco (tabela registro_erros), lido em /admin.
 *
 * Sem "server-only" de propósito: também é importado por src/instrumentation.ts.
 * Nunca lança: se o banco falhar, o erro vai só para o console (log da Vercel).
 * Não grave aqui pergunta, resposta ou documento de cliente; só o técnico.
 */
import { Pool } from "pg";

let pool: Pool | null = null;

export interface ContextoErro {
  rota?: string | null;
  codigo?: string | null;
  usuarioId?: string | null;
  escritorioId?: string | null;
  detalhes?: Record<string, unknown>;
}

/** Tira query string e identificadores longos que possam vir na URL. */
export function limparRota(rota: string | null | undefined): string | null {
  if (!rota) return null;
  return rota.split("?")[0].slice(0, 300);
}

export function mensagemDe(erro: unknown): string {
  if (erro instanceof Error) return `${erro.name !== "Error" ? `${erro.name}: ` : ""}${erro.message}`.slice(0, 1000);
  return String(erro).slice(0, 1000);
}

export async function registrarErro(origem: string, erro: unknown, ctx: ContextoErro = {}): Promise<void> {
  const mensagem = mensagemDe(erro);
  const codigo = ctx.codigo ?? (typeof erro === "object" && erro && "digest" in erro ? String((erro as { digest: unknown }).digest) : null);
  console.error(`[${origem}]`, mensagem, codigo ?? "");
  if (!process.env.DATABASE_URL) return;
  try {
    pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.escritorio_id', $1, true), set_config('app.usuario_id', $2, true)", [
        ctx.escritorioId ?? "",
        ctx.usuarioId ?? "",
      ]);
      await c.query(`select app.registrar_erro($1, $2, $3, $4, $5)`, [
        origem,
        mensagem,
        limparRota(ctx.rota),
        codigo,
        JSON.stringify(ctx.detalhes ?? {}),
      ]);
      await c.query("commit");
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  } catch (e) {
    console.error("[registro-erros] falhou ao gravar:", mensagemDe(e));
  }
}
