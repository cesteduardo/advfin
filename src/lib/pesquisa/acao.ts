"use server";

import { z } from "zod";
import { exigirSessao, type Sessao } from "@/lib/auth/sessao";
import { pesquisar, type DesfechoPesquisa, type Diagnostico } from "./orquestrador";

const Pedido = z.object({
  pergunta: z.string().trim().min(8, "Escreva a pergunta com um pouco mais de contexto.").max(2000),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  caso: z.string().uuid().nullable().optional(),
});

/** A consulta pode entrar num caso; o banco recusa caso que a pessoa não vê. */
export async function acaoPesquisar(pergunta: string, data: string, caso?: string | null): Promise<DesfechoPesquisa | { status: "invalida"; mensagem: string }> {
  const s = await exigirSessao();
  const r = Pedido.safeParse({ pergunta, data, caso: caso || null });
  if (!r.success) return { status: "invalida", mensagem: r.error.issues[0]?.message ?? "Pergunta inválida." };
  return pesquisar({ usuarioId: s.usuarioId, escritorioId: s.escritorioId }, r.data.pergunta, r.data.data, r.data.caso ?? null);
}

/**
 * Laboratório do chat: em produção, só para a equipe da plataforma (admin ou curador).
 * Fora de produção, qualquer usuário logado, como antes.
 */
export async function podeUsarDev(s: Pick<Sessao, "plataforma">): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  return s.plataforma === "admin" || s.plataforma === "curador";
}

export async function acaoPesquisarDev(
  pergunta: string,
  data: string,
  forcarExtrativo: boolean,
): Promise<{ desfecho: DesfechoPesquisa | { status: "invalida"; mensagem: string }; diagnostico: Diagnostico | null }> {
  const s = await exigirSessao();
  if (!(await podeUsarDev(s))) throw new Error("acesso restrito");
  const r = Pedido.safeParse({ pergunta, data });
  if (!r.success) return { desfecho: { status: "invalida", mensagem: r.error.issues[0]?.message ?? "Pergunta inválida." }, diagnostico: null };
  let diagnostico: Diagnostico | null = null;
  const desfecho = await pesquisar({ usuarioId: s.usuarioId, escritorioId: s.escritorioId }, r.data.pergunta, r.data.data, null, {
    forcarExtrativo,
    aoDiagnosticar: (d) => (diagnostico = d),
  });
  return { desfecho, diagnostico };
}
