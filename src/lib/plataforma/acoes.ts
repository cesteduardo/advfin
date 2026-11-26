"use server";

import { refresh } from "next/cache";
import { mensagemDeErro } from "@/lib/auth/erros";
import { exigirPlataforma } from "@/lib/auth/sessao";
import { comoUsuario } from "@/lib/db";

export interface Resultado {
  erro?: string;
  ok?: string;
}

export async function decidirCuradoria(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPlataforma(["curador"]);
  const status = String(form.get("status"));
  try {
    await comoUsuario(s.usuarioId, (c) => c.query(`select app.plat_curadoria_decidir($1, $2, $3)`, [form.get("id"), status, form.get("nota") || null]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: status === "publicado" ? "Publicado: já entra na pesquisa." : status === "rejeitado" ? "Rejeitado." : "Anotado." };
}

export async function verificarOab(form: FormData): Promise<void> {
  const s = await exigirPlataforma(["suporte"]);
  await comoUsuario(s.usuarioId, (c) => c.query(`select app.plat_oab_verificar($1)`, [form.get("usuario")]));
  refresh();
}

export async function definirPapel(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPlataforma();
  const papel = String(form.get("papel") ?? "");
  try {
    await comoUsuario(s.usuarioId, (c) => c.query(`select app.plat_definir_papel($1, $2)`, [form.get("email"), papel === "nenhum" ? null : papel]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: "Equipe atualizada." };
}
