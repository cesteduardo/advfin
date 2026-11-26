"use server";

import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { pesquisar, type DesfechoPesquisa } from "./orquestrador";

const Pedido = z.object({
  pergunta: z.string().trim().min(8, "Escreva a pergunta com um pouco mais de contexto.").max(2000),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function acaoPesquisar(pergunta: string, data: string): Promise<DesfechoPesquisa | { status: "invalida"; mensagem: string }> {
  const s = await exigirSessao();
  const r = Pedido.safeParse({ pergunta, data });
  if (!r.success) return { status: "invalida", mensagem: r.error.issues[0]?.message ?? "Pergunta inválida." };
  return pesquisar({ usuarioId: s.usuarioId, escritorioId: s.escritorioId }, r.data.pergunta, r.data.data);
}
