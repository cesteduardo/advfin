"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { comoUsuario, consultar } from "@/lib/db";
import { VERSAO_TERMOS } from "@/lib/legal/versao";
import { registrarErro } from "@/lib/registro-erros";
import { mensagemDeErro } from "./erros";
import { abrirDesafio, abrirSessao, encerrarSessao, exigirSessao, hashDesafio } from "./sessao";
import { conferirSenha, gerarHashSenha, hashToken, senhaFraca } from "./senha";
import { conferirCodigo, decifrar, hashCodigoRecuperacao } from "./totp";

export interface EstadoForm {
  erro?: string;
  aviso?: string;
  email?: string;
}

const COOKIE_CONVITE = "advfin_convite";

/** Limite simples por chave: 8 tentativas em 15 minutos (por instância do servidor). */
const tentativas = new Map<string, number[]>();
function excedeuLimite(chave: string): boolean {
  const agora = Date.now();
  const janela = (tentativas.get(chave) ?? []).filter((t) => agora - t < 15 * 60_000);
  janela.push(agora);
  tentativas.set(chave, janela);
  return janela.length > 8;
}

/** Só caminhos internos da área logada, para o "volta" não virar redirecionamento aberto. */
function destino(volta: FormDataEntryValue | null): string {
  const v = typeof volta === "string" ? volta : "";
  return /^\/(app|admin)(\/[\w\-/]*)?(\?[\w=&%-]*)?$/.test(v) ? v : "/app";
}

/** Depois de e-mail, senha e (se houver) código: aceita o convite pendente e abre a sessão. */
async function concluirEntrada(usuarioId: string, escritorioId: string | null, volta: string): Promise<never> {
  const jar = await cookies();
  const convite = jar.get(COOKIE_CONVITE)?.value;
  let esc = escritorioId;
  if (convite) {
    jar.delete(COOKIE_CONVITE);
    try {
      esc = await comoUsuario(usuarioId, async (c) => (await c.query(`select app.aceitar_convite($1) e`, [hashToken(convite)])).rows[0].e);
      volta = "/app";
    } catch (e) {
      // Convite inválido não impede o login no escritório de sempre.
      console.error("convite no login", (e as Error).message);
    }
  }
  if (!esc) redirect("/entrar?sem=1");
  await abrirSessao(usuarioId, esc);
  redirect(volta);
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
  if (!ok) return { erro: "E-mail ou senha não conferem.", email };

  const convite = form.get("convite");
  if (typeof convite === "string" && convite) {
    (await cookies()).set(COOKIE_CONVITE, convite, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 10 * 60 });
  }
  const temConvite = typeof convite === "string" && Boolean(convite);
  if (!c.escritorio_id && !temConvite) {
    if (c.pedido_pendente) return { aviso: `Seu pedido para entrar em ${c.pedido_pendente} aguarda a aprovação de um administrador.`, email };
    return { erro: "Sua conta não tem acesso ativo a nenhum escritório. Peça um convite.", email };
  }
  const volta = destino(form.get("volta"));
  if (c.totp_ativo) {
    let esc: string | null = c.escritorio_id;
    if (!esc && temConvite) {
      // Sem escritório ativo, o desafio precisa de um: o do convite. Entrar nele não abre sessão;
      // a sessão só sai depois do código.
      try {
        esc = await comoUsuario(c.usuario_id, async (x) => (await x.query(`select app.aceitar_convite($1) e`, [hashToken(String(convite))])).rows[0].e);
        (await cookies()).delete(COOKIE_CONVITE);
      } catch (e) {
        return { erro: mensagemDeErro(e), email };
      }
    }
    await abrirDesafio(c.usuario_id, esc!);
    redirect(`/entrar/verificar?volta=${encodeURIComponent(volta)}`);
  }
  return concluirEntrada(c.usuario_id, c.escritorio_id, volta);
}

/** Segundo passo: código do aplicativo ou um código de recuperação. */
export async function verificarSegundoFator(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const desafio = await hashDesafio();
  if (!desafio) redirect("/entrar");
  const codigo = String(form.get("codigo") ?? "").trim();
  const recuperacao = form.get("modo") === "recuperacao";
  const [d] = await consultar(`select * from app.desafio_ler($1)`, [desafio]);
  if (!d) return { erro: "O tempo para o código acabou. Entre de novo com e-mail e senha." };

  let ids: { usuario_id: string; escritorio_id: string } | undefined;
  if (recuperacao) {
    [ids] = await consultar(`select * from app.desafio_recuperacao($1, $2)`, [desafio, hashCodigoRecuperacao(codigo)]);
    if (!ids) return { erro: "Código de recuperação não confere ou já foi usado." };
  } else {
    const passo = conferirCodigo(decifrar(d.segredo_cifrado), codigo, d.ultimo_passo === null ? null : Number(d.ultimo_passo));
    if (passo === null) {
      await consultar(`select app.desafio_falhou($1)`, [desafio]);
      return { erro: "Código não confere. Confira o relógio do celular e tente o código seguinte." };
    }
    try {
      [ids] = await consultar(`select * from app.desafio_concluir($1, $2)`, [desafio, passo]);
    } catch (e) {
      return { erro: mensagemDeErro(e) };
    }
  }
  return concluirEntrada(ids!.usuario_id, ids!.escritorio_id, destino(form.get("volta")));
}

/** Guarda a versão dos Termos e da Política que a pessoa aceitou no cadastro. Falha não impede a conta. */
async function registrarAceite(usuarioId: string): Promise<void> {
  try {
    await comoUsuario(usuarioId, (c) => c.query(`select app.registrar_aceite($1)`, [VERSAO_TERMOS]));
  } catch (e) {
    await registrarErro("aceite", e, { rota: "/cadastro", usuarioId });
  }
}

const Cadastro = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  escritorio: z.string().trim().max(160).optional(),
  senha: z.string(),
  aceite: z.literal("on"),
});

/** Ao sair do campo de e-mail: o domínio já pertence a um escritório? */
export async function consultarDominio(email: string): Promise<{ id: string; nome: string } | null> {
  const e = z.string().trim().toLowerCase().email().safeParse(email);
  if (!e.success) return null;
  const [l] = await consultar(`select * from app.escritorio_do_dominio($1)`, [e.data]);
  return l ? { id: l.escritorio_id, nome: l.nome } : null;
}

export async function cadastrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const dados = Object.fromEntries(["nome", "email", "escritorio", "senha", "aceite"].map((k) => [k, form.get(k) ?? undefined]));
  const r = Cadastro.safeParse(dados);
  const email = String(form.get("email") ?? "");
  if (!r.success) {
    const aceite = r.error.issues.some((i) => i.path[0] === "aceite");
    return { erro: aceite ? "É preciso aceitar os Termos e a Política de Privacidade." : "Revise nome e e-mail.", email };
  }
  const fraca = senhaFraca(r.data.senha);
  if (fraca) return { erro: fraca, email };
  if (excedeuLimite(`cadastro:${r.data.email}`)) return { erro: "Muitas tentativas. Aguarde alguns minutos.", email };

  const pedirEntrada = form.get("entrada");
  const hash = await gerarHashSenha(r.data.senha);
  if (typeof pedirEntrada === "string" && pedirEntrada) {
    try {
      const [{ u }] = await consultar(`select app.cadastrar_pedindo_entrada($1, $2, $3, $4) u`, [r.data.email, r.data.nome, hash, pedirEntrada]);
      await registrarAceite(u);
    } catch (e) {
      return { erro: mensagemDeErro(e, "Não foi possível criar a conta agora."), email };
    }
    return { aviso: "Conta criada. Um administrador do escritório precisa aprovar sua entrada; você recebe acesso assim que ele aprovar.", email };
  }

  if (!r.data.escritorio || r.data.escritorio.length < 2) return { erro: "Informe o nome do escritório.", email };
  let ids: { usuario_id: string; escritorio_id: string };
  try {
    [ids] = await consultar(`select * from app.cadastrar($1, $2, $3, $4)`, [r.data.email, r.data.nome, hash, r.data.escritorio]);
  } catch (e) {
    return { erro: mensagemDeErro(e, "Não foi possível criar a conta agora."), email };
  }
  await registrarAceite(ids.usuario_id);
  await abrirSessao(ids.usuario_id, ids.escritorio_id);
  redirect("/app");
}

const PorConvite = z.object({ nome: z.string().trim().min(2).max(120), senha: z.string(), aceite: z.literal("on"), convite: z.string().min(10) });

/** Quem ainda não tem conta cria uma pelo convite e já entra no escritório. */
export async function cadastrarPorConvite(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const r = PorConvite.safeParse(Object.fromEntries(["nome", "senha", "aceite", "convite"].map((k) => [k, form.get(k) ?? undefined])));
  if (!r.success) {
    const aceite = r.error.issues.some((i) => i.path[0] === "aceite");
    return { erro: aceite ? "É preciso aceitar os Termos e a Política de Privacidade." : "Informe seu nome." };
  }
  const fraca = senhaFraca(r.data.senha);
  if (fraca) return { erro: fraca };
  let ids: { usuario_id: string; escritorio_id: string };
  try {
    [ids] = await consultar(`select * from app.cadastrar_por_convite($1, $2, $3)`, [hashToken(r.data.convite), r.data.nome, await gerarHashSenha(r.data.senha)]);
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  await registrarAceite(ids.usuario_id);
  await abrirSessao(ids.usuario_id, ids.escritorio_id);
  redirect("/app");
}

/** Quem já está logado com o e-mail convidado aceita e passa para o escritório novo. */
export async function aceitarConviteLogado(form: FormData): Promise<void> {
  const s = await exigirSessao();
  const token = String(form.get("convite") ?? "");
  const esc = await comoUsuario(s.usuarioId, async (c) => (await c.query(`select app.aceitar_convite($1) e`, [hashToken(token)])).rows[0].e);
  await encerrarSessao();
  await abrirSessao(s.usuarioId, esc);
  redirect("/app");
}

/** Para quem atua em mais de um escritório: nova sessão no outro, e a atual se encerra. */
export async function trocarEscritorio(form: FormData): Promise<void> {
  const s = await exigirSessao();
  const alvo = String(form.get("escritorio") ?? "");
  if (alvo === s.escritorioId) redirect("/app");
  await encerrarSessao();
  await abrirSessao(s.usuarioId, alvo); // criar_sessao recusa se não houver vínculo ativo
  redirect("/app");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/entrar");
}
