"use server";

import { z } from "zod";
import { mensagemDeErro } from "@/lib/auth/erros";
import { exigirSessao, type Sessao } from "@/lib/auth/sessao";
import { noEscritorio } from "@/lib/db";
import { conferirCota, mensagemDeCota } from "@/lib/uso/limites";
import { pesquisar, type DesfechoPesquisa, type Diagnostico } from "./orquestrador";
import { MAX_DOCUMENTOS, MAX_TEXTO_DOCUMENTO, type DocumentoAnexo } from "./geracao";

const Pedido = z.object({
  pergunta: z.string().trim().min(8, "Escreva a pergunta com um pouco mais de contexto.").max(2000),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  caso: z.string().uuid().nullable().optional(),
  documentos: z
    .array(z.object({ nome: z.string().max(200), texto: z.string().max(MAX_TEXTO_DOCUMENTO) }))
    .max(MAX_DOCUMENTOS)
    .default([]),
});

/** A consulta pode entrar num caso; o banco recusa caso que a pessoa não vê. */
export async function acaoPesquisar(pergunta: string, data: string, caso?: string | null, documentos: DocumentoAnexo[] = []): Promise<DesfechoPesquisa | { status: "invalida"; mensagem: string }> {
  const s = await exigirSessao();
  const r = Pedido.safeParse({ pergunta, data, caso: caso || null, documentos });
  if (!r.success) return { status: "invalida", mensagem: r.error.issues[0]?.message ?? "Pergunta inválida." };
  const ctx = { usuarioId: s.usuarioId, escritorioId: s.escritorioId };
  const cota = await conferirCota(ctx);
  if (!cota.permitido) return { status: "invalida", mensagem: mensagemDeCota(cota) };
  return pesquisar(ctx, r.data.pergunta, r.data.data, r.data.caso ?? null, { documentos: r.data.documentos });
}

const Relato = z.object({
  consulta: z.string().uuid().nullable(),
  dispositivo: z.string().uuid(),
  trecho: z.string().max(2000).default(""),
  motivo: z.enum(["texto_diferente", "dispositivo_errado", "fora_de_vigencia", "nao_sustenta", "outro"]),
  comentario: z.string().trim().max(1000).default(""),
});
export type MotivoRelato = z.infer<typeof Relato>["motivo"];

/** "Relatar citação errada": vai para a fila do curador em /admin, sem a pergunta. */
export async function acaoRelatarCitacao(dados: {
  consulta: string | null;
  dispositivo: string;
  trecho: string;
  motivo: MotivoRelato;
  comentario: string;
}): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const s = await exigirSessao();
  const r = Relato.safeParse(dados);
  if (!r.success) return { ok: false, mensagem: "Escolha o motivo do relato." };
  try {
    await noEscritorio(s, (c) =>
      c.query(`select app.relatar_citacao($1, $2, $3, $4, $5)`, [r.data.consulta, r.data.dispositivo, r.data.trecho, r.data.motivo, r.data.comentario]),
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, mensagem: mensagemDeErro(e, "Não foi possível enviar o relato agora.") };
  }
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
