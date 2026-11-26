import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { consultar } from "@/lib/db";
import { hashToken, novoToken } from "./senha";

export const COOKIE_SESSAO = "advfin_sessao";
const DIAS = 14;

export interface Sessao {
  usuarioId: string;
  escritorioId: string;
  nome: string;
  email: string;
  escritorio: string;
  papel: "socio" | "associado" | "estagiario";
}

export async function abrirSessao(usuarioId: string, escritorioId: string): Promise<void> {
  const token = novoToken();
  await consultar(`select app.criar_sessao($1, $2, $3, $4)`, [hashToken(token), usuarioId, escritorioId, DIAS]);
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS * 24 * 60 * 60,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) await consultar(`select app.encerrar_sessao($1)`, [hashToken(token)]);
  jar.delete(COOKIE_SESSAO);
}

/** Sessão da requisição atual (memorizada por requisição). */
export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const [l] = await consultar(`select * from app.resolver_sessao($1)`, [hashToken(token)]);
  if (!l) return null;
  return {
    usuarioId: l.usuario_id,
    escritorioId: l.escritorio_id,
    nome: l.nome,
    email: l.email,
    escritorio: l.escritorio,
    papel: l.papel,
  };
});

/** Para páginas e ações da área logada: sem sessão válida, volta ao login. */
export async function exigirSessao(): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  return s;
}
