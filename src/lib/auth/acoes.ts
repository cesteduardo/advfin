"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { consultar } from "@/lib/db";
import { abrirSessao, encerrarSessao } from "./sessao";
import { conferirSenha, gerarHashSenha, senhaFraca } from "./senha";

export interface EstadoForm {
  erro?: string;
  email?: string;
}

/** Limite simples por e-mail: 8 tentativas em 15 minutos (por instância do servidor). */
const tentativas = new Map<string, number[]>();
function excedeuLimite(chave: string): boolean {
  const agora = Date.now();
  const janela = (tentativas.get(chave) ?? []).filter((t) => agora - t < 15 * 60_000);
  janela.push(agora);
  tentativas.set(chave, janela);
  return janela.length > 8;
}

const Login = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  senha: z.string().min(1).max(200),
});

export async function entrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const r = Login.safeParse({ email: form.get("email"), senha: form.get("senha") });
  if (!r.success) return { erro: "Informe e-mail e senha.", email: String(form.get("email") ?? "") };
  const { email, senha } = r.data;
  if (excedeuLimite(email)) return { erro: "Muitas tentativas. Aguarde alguns minutos.", email };

  const [c] = await consultar(`select * from app.credenciais($1)`, [email]);
  const ok = await conferirSenha(senha, c?.senha_hash);
  if (!ok || !c?.escritorio_id) return { erro: "E-mail ou senha não conferem.", email };

  await abrirSessao(c.usuario_id, c.escritorio_id);
  redirect("/app");
}

const Cadastro = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  escritorio: z.string().trim().min(2).max(160),
  senha: z.string(),
  aceite: z.literal("on"),
});

export async function cadastrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const dados = Object.fromEntries(["nome", "email", "escritorio", "senha", "aceite"].map((k) => [k, form.get(k) ?? undefined]));
  const r = Cadastro.safeParse(dados);
  const email = String(form.get("email") ?? "");
  if (!r.success) {
    const aceite = r.error.issues.some((i) => i.path[0] === "aceite");
    return { erro: aceite ? "É preciso aceitar os Termos e a Política de Privacidade." : "Revise nome, e-mail e escritório.", email };
  }
  const fraca = senhaFraca(r.data.senha);
  if (fraca) return { erro: fraca, email };
  if (excedeuLimite(`cadastro:${r.data.email}`)) return { erro: "Muitas tentativas. Aguarde alguns minutos.", email };

  let ids: { usuario_id: string; escritorio_id: string };
  try {
    [ids] = await consultar(`select * from app.cadastrar($1, $2, $3, $4)`, [
      r.data.email,
      r.data.nome,
      await gerarHashSenha(r.data.senha),
      r.data.escritorio,
    ]);
  } catch (e) {
    if ((e as Error).message.includes("email_em_uso")) return { erro: "Já existe uma conta com este e-mail.", email };
    console.error("cadastro", (e as Error).message);
    return { erro: "Não foi possível criar a conta agora.", email };
  }
  await abrirSessao(ids.usuario_id, ids.escritorio_id);
  redirect("/app");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/entrar");
}
