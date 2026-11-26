"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { z } from "zod";
import { mensagemDeErro } from "@/lib/auth/erros";
import { encerrarSessao, exigirSessao, hashSessaoAtual } from "@/lib/auth/sessao";
import { conferirSenha, gerarHashSenha, hashToken, novoToken, senhaFraca } from "@/lib/auth/senha";
import {
  conferirCodigo, cifrar, decifrar, hashCodigoRecuperacao, novoSegredo, novosCodigosRecuperacao, uriOtpauth, verificacaoDisponivel,
} from "@/lib/auth/totp";
import { comoUsuario, noEscritorio } from "@/lib/db";
import { emailConfigurado, enviarEmail, textoTrocaEmail, urlPublica } from "@/lib/email";

export interface Resultado {
  erro?: string;
  ok?: string;
  /** Link mostrado na tela quando não há provedor de e-mail (só fora de produção). */
  link?: string;
  /** Códigos de recuperação: aparecem uma vez. */
  codigos?: string[];
}

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const Dados = z.object({
  nome: z.string().trim().min(2, "Informe um nome com ao menos 2 letras.").max(120),
  cargo: z.string().trim().max(80).optional(),
  oab_numero: z.string().trim().max(20).regex(/^[\dA-Za-z.\-/ ]*$/, "Número da OAB inválido.").optional(),
  oab_uf: z.string().trim().toUpperCase().optional(),
});

export async function salvarDados(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const r = Dados.safeParse(Object.fromEntries(["nome", "cargo", "oab_numero", "oab_uf"].map((k) => [k, form.get(k) ?? undefined])));
  if (!r.success) return { erro: r.error.issues[0]?.message };
  const uf = r.data.oab_numero ? r.data.oab_uf || null : null;
  if (r.data.oab_numero && (!uf || !UFS.includes(uf))) return { erro: "Escolha a UF da OAB." };
  try {
    await noEscritorio(s, async (c) => {
      await c.query(`select app.atualizar_perfil($1, $2, $3, null)`, [r.data.nome, r.data.oab_numero || null, uf]);
      await c.query(`update membros set cargo = $1 where escritorio_id = $2 and usuario_id = $3`, [r.data.cargo || null, s.escritorioId, s.usuarioId]);
    });
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: "Dados salvos." };
}

/** A foto chega já reduzida no navegador (256 px, WebP ou JPEG), como data URL. */
export async function salvarFoto(dataUrl: string | null): Promise<Resultado> {
  const s = await exigirSessao();
  if (dataUrl && dataUrl.length > 300_000) return { erro: "Imagem grande demais. Use uma de até 200 KB." };
  try {
    await comoUsuario(s.usuarioId, (c) => c.query(`select app.atualizar_foto($1)`, [dataUrl]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: dataUrl ? "Foto atualizada." : "Foto removida." };
}

export async function pedirTrocaEmail(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const r = z.string().trim().toLowerCase().email().max(200).safeParse(form.get("email"));
  if (!r.success) return { erro: "Informe um e-mail válido." };
  if (r.data === s.email) return { erro: "Este já é o seu e-mail." };
  if (!emailConfigurado() && process.env.NODE_ENV === "production") {
    return { erro: "A troca de e-mail depende do envio de e-mails, que ainda não foi configurado." };
  }
  const token = novoToken();
  try {
    await comoUsuario(s.usuarioId, (c) => c.query(`select app.pedir_troca_email($1, $2)`, [r.data, hashToken(token)]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  const link = urlPublica(`/email/confirmar/${token}`);
  const enviado = await enviarEmail({ para: r.data, assunto: "Confirme seu novo e-mail no AdvFin", texto: textoTrocaEmail({ link }) });
  refresh();
  return enviado
    ? { ok: `Enviamos um link para ${r.data}. O e-mail só muda quando você abrir esse link.` }
    : { ok: "Sem provedor de e-mail neste ambiente: abra o link abaixo para confirmar.", link };
}

export async function trocarSenha(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const atual = String(form.get("atual") ?? "");
  const nova = String(form.get("nova") ?? "");
  if (nova !== String(form.get("confirmacao") ?? "")) return { erro: "A confirmação não é igual à senha nova." };
  const fraca = senhaFraca(nova);
  if (fraca) return { erro: fraca };
  const hashAtual = await noEscritorio(s, async (c) => (await c.query(`select app.minha_senha_hash() h`)).rows[0].h);
  if (!(await conferirSenha(atual, hashAtual))) return { erro: "A senha atual não confere." };
  await noEscritorio(s, async (c) => c.query(`select app.trocar_senha($1, $2)`, [await gerarHashSenha(nova), await hashSessaoAtual()]));
  refresh();
  return { ok: "Senha trocada. Os outros aparelhos foram desconectados." };
}

export async function encerrarSessaoPorId(form: FormData): Promise<void> {
  const s = await exigirSessao();
  await comoUsuario(s.usuarioId, (c) => c.query(`select app.encerrar_minha_sessao($1)`, [String(form.get("id"))]));
  refresh();
}

export async function encerrarOutrasSessoes(): Promise<void> {
  const s = await exigirSessao();
  await comoUsuario(s.usuarioId, async (c) => c.query(`select app.encerrar_outras_sessoes($1)`, [await hashSessaoAtual()]));
  refresh();
}

// ── Verificação em duas etapas ──

export async function iniciar2fa(): Promise<{ erro?: string; segredo?: string; uri?: string; qr?: string }> {
  const s = await exigirSessao();
  if (!verificacaoDisponivel()) return { erro: "A verificação em duas etapas ainda não foi configurada no servidor." };
  const segredo = novoSegredo();
  try {
    await comoUsuario(s.usuarioId, (c) => c.query(`select app.totp_preparar($1)`, [cifrar(segredo)]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  const uri = uriOtpauth(segredo, s.email);
  const qr = await QRCode.toString(uri, { type: "svg", margin: 1, color: { dark: "#0f2742", light: "#ffffff" } });
  return { segredo: segredo.replace(/(.{4})/g, "$1 ").trim(), uri, qr };
}

export async function confirmar2fa(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const [t] = await comoUsuario(s.usuarioId, async (c) => (await c.query(`select * from app.totp_meu()`)).rows);
  if (!t?.segredo_cifrado) return { erro: "Comece de novo: gere o QR code." };
  const passo = conferirCodigo(decifrar(t.segredo_cifrado), String(form.get("codigo") ?? ""), null);
  if (passo === null) return { erro: "Código não confere. Digite o que o aplicativo mostra agora." };
  const codigos = novosCodigosRecuperacao();
  try {
    await noEscritorio(s, (c) => c.query(`select app.totp_ativar($1, $2)`, [passo, codigos.map(hashCodigoRecuperacao)]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: "Verificação em duas etapas ativada.", codigos };
}

async function conferirSenhaAtual(s: { usuarioId: string; escritorioId: string }, senha: string) {
  const h = await noEscritorio(s, async (c) => (await c.query(`select app.minha_senha_hash() h`)).rows[0].h);
  return conferirSenha(senha, h);
}

export async function desativar2fa(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  if (!(await conferirSenhaAtual(s, String(form.get("senha") ?? "")))) return { erro: "A senha não confere." };
  try {
    await noEscritorio(s, (c) => c.query(`select app.totp_desativar()`));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: "Verificação em duas etapas desativada." };
}

export async function gerarNovosCodigos(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  if (!(await conferirSenhaAtual(s, String(form.get("senha") ?? "")))) return { erro: "A senha não confere." };
  const codigos = novosCodigosRecuperacao();
  try {
    await comoUsuario(s.usuarioId, (c) => c.query(`select app.totp_novos_codigos($1)`, [codigos.map(hashCodigoRecuperacao)]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: "Códigos novos gerados. Os antigos deixaram de valer.", codigos };
}

// ── Preferências ──

export async function salvarPreferencias(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const modo = form.get("vigencia_modo");
  const data = String(form.get("vigencia_data") ?? "");
  if (modo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(data)) return { erro: "Escolha a data fixa de vigência." };
  const preferencias = {
    vigencia: modo === "data" ? data : "hoje",
    avisos: { convites: form.get("aviso_convites") === "on", revisoes: form.get("aviso_revisoes") === "on", resumo: form.get("aviso_resumo") === "on" },
  };
  await comoUsuario(s.usuarioId, async (c) => {
    const [p] = (await c.query(`select nome, oab_numero, oab_uf from app.meu_perfil()`)).rows;
    await c.query(`select app.atualizar_perfil($1, $2, $3, $4)`, [p.nome, p.oab_numero, p.oab_uf, JSON.stringify(preferencias)]);
  });
  refresh();
  return { ok: "Preferências salvas." };
}

// ── Escritórios e privacidade ──

export async function sairDoEscritorio(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  if (!(await conferirSenhaAtual(s, String(form.get("senha") ?? "")))) return { erro: "A senha não confere." };
  try {
    await noEscritorio(s, (c) => c.query(`select app.sair_do_escritorio()`));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  await encerrarSessao();
  redirect("/entrar?saiu=1");
}

export async function pedirExclusaoConta(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  if (String(form.get("confirmacao") ?? "").trim().toLowerCase() !== s.email) return { erro: "Digite seu e-mail para confirmar." };
  if (!(await conferirSenhaAtual(s, String(form.get("senha") ?? "")))) return { erro: "A senha não confere." };
  try {
    await noEscritorio(s, (c) => c.query(`select app.pedir_exclusao_conta()`));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  await encerrarSessao();
  redirect("/entrar?excluida=1");
}
