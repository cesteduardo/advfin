"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mensagemDeErro } from "@/lib/auth/erros";
import { exigirPermissao, exigirSessao } from "@/lib/auth/sessao";
import { noEscritorio } from "@/lib/db";

export interface Resultado {
  erro?: string;
  ok?: string;
}

const Caso = z.object({
  titulo: z.string().trim().min(3, "Dê um título ao caso.").max(160),
  cliente: z.string().trim().max(160).optional(),
});

export async function criarCaso(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("criar_caso");
  const r = Caso.safeParse({ titulo: form.get("titulo"), cliente: form.get("cliente") || undefined });
  if (!r.success) return { erro: r.error.issues[0]?.message };
  const id = await noEscritorio(s, async (c) => {
    const { rows } = await c.query(`insert into casos (escritorio_id, titulo, cliente) values ($1, $2, $3) returning id`, [s.escritorioId, r.data.titulo, r.data.cliente ?? null]);
    await c.query(`insert into auditoria (escritorio_id, usuario_id, acao, alvo_id) values ($1, $2, 'caso_criado', $3)`, [s.escritorioId, s.usuarioId, rows[0].id]);
    return rows[0].id as string;
  });
  redirect(`/app/casos/${id}`);
}

export async function incluirNoCaso(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  try {
    const r = await noEscritorio(s, async (c) => (await c.query(`select app.incluir_no_caso($1, $2) r`, [form.get("caso"), form.get("usuario")])).rows[0].r);
    refresh();
    return { ok: r === "revisao" ? "Pedido enviado: um Membro precisa aprovar a inclusão." : "Pessoa incluída no caso." };
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
}

export async function retirarDoCaso(form: FormData): Promise<void> {
  const s = await exigirSessao();
  await noEscritorio(s, (c) => c.query(`select app.retirar_do_caso($1, $2)`, [form.get("caso"), form.get("usuario")]));
  refresh();
}

export async function decidirRevisao(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const aprovar = form.get("aprovar") === "1";
  try {
    await noEscritorio(s, (c) => c.query(`select app.decidir_revisao($1, $2, $3)`, [form.get("id"), aprovar, form.get("nota") || null]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: aprovar ? "Aprovado." : "Recusado." };
}

/** Exportar parecer: liberado, ou pedido de revisão para o Supervisionado. */
export async function pedirExportacao(consulta: string, formato: "pdf" | "docx"): Promise<{ estado: "liberado" | "revisao" | "pendente" } | { erro: string }> {
  const s = await exigirSessao();
  try {
    const estado = await noEscritorio(s, async (c) => (await c.query(`select app.pedir_exportacao($1, $2) r`, [consulta, formato])).rows[0].r);
    if (estado !== "liberado") refresh();
    return { estado };
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
}
