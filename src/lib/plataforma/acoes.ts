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

export async function decidirRelato(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPlataforma(["curador"]);
  const status = String(form.get("status"));
  const tirar = form.get("tirar") === "on";
  try {
    await comoUsuario(s.usuarioId, (c) =>
      c.query(`select app.plat_relato_decidir($1, $2, $3, $4)`, [form.get("id"), status, form.get("nota") || null, tirar]),
    );
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: status === "procedente" ? (tirar ? "Procedente: o dispositivo voltou para a revisão e saiu da pesquisa." : "Procedente.") : "Improcedente." };
}

const inteiro = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

export async function definirLimite(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPlataforma(["suporte"]);
  const [dia, mes, esc] = ["dia", "mes", "escritorio_mes"].map((k) => inteiro(form.get(k)));
  if ([dia, mes, esc].some((n) => Number.isNaN(n))) return { erro: "Use números inteiros, ou deixe em branco para o padrão." };
  try {
    await comoUsuario(s.usuarioId, (c) =>
      c.query(`select app.plat_definir_limite($1, $2, $3, $4, $5)`, [form.get("escritorio"), dia, mes, esc, form.get("nota") || null]),
    );
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: dia === null && mes === null && esc === null ? "Voltou aos limites padrão." : "Limite especial salvo." };
}
