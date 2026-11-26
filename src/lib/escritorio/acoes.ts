"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mensagemDeErro } from "@/lib/auth/erros";
import { NIVEIS, ROTULO_NIVEL, type Nivel } from "@/lib/auth/niveis";
import { encerrarSessao, exigirPermissao, exigirSessao, type Sessao } from "@/lib/auth/sessao";
import { conferirSenha, hashToken, novoToken } from "@/lib/auth/senha";
import { noEscritorio } from "@/lib/db";
import { enviarEmail, textoConvite, urlPublica } from "@/lib/email";
import { PLANOS, ajustarAssentos, criarCheckout, criarCliente, criarPortal, precoDoPlano, stripeConfigurado, type Plano } from "@/lib/stripe";

export interface Resultado {
  erro?: string;
  ok?: string;
  link?: string;
  /** O Titular precisa confirmar mais um assento antes de convidar. */
  confirmarAssento?: boolean;
  valores?: Record<string, string>;
}

const nivelValido = (v: unknown): v is Nivel => typeof v === "string" && (NIVEIS as readonly string[]).includes(v);

async function enviarConvite(s: Sessao, email: string, nivel: Nivel, token: string): Promise<Resultado> {
  const link = urlPublica(`/convite/${token}`);
  try {
    const enviado = await enviarEmail({
      para: email,
      assunto: `Convite para ${s.escritorio} no AdvFin`,
      texto: textoConvite({ escritorio: s.escritorio, quem: s.nome, nivel: ROTULO_NIVEL[nivel], link }),
    });
    return enviado ? { ok: `Convite enviado para ${email}.` } : { ok: `Convite criado. Sem provedor de e-mail configurado: envie o link a ${email}.`, link };
  } catch {
    return { ok: `Convite criado, mas o e-mail falhou. Envie o link a ${email}.`, link };
  }
}

/** Quando o Titular confirma um assento a mais, a assinatura sobe na hora, com valor proporcional. */
async function somarAssento(s: Sessao): Promise<void> {
  if (!stripeConfigurado()) return;
  const [c] = await noEscritorio(s, async (x) => (await x.query(`select * from app.cobranca()`)).rows);
  if (c?.stripe_assinatura_id) await ajustarAssentos(c.stripe_assinatura_id, (c.assentos ?? 0) + 1);
}

const Convite = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(200),
  cargo: z.string().trim().max(80).optional(),
});

export async function convidar(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("gerir_pessoas");
  const r = Convite.safeParse({ email: form.get("email"), cargo: form.get("cargo") || undefined });
  const nivel = form.get("nivel");
  if (!r.success) return { erro: r.error.issues[0]?.message };
  if (!nivelValido(nivel)) return { erro: "Escolha o nível." };
  const confirmar = form.get("confirmar_assento") === "on";
  const token = novoToken();
  let linha: { id: string; aguarda_titular: boolean };
  try {
    [linha] = await noEscritorio(s, async (c) =>
      (await c.query(`select * from app.criar_convite($1, $2, $3, $4, $5)`, [r.data.email, nivel, r.data.cargo ?? null, hashToken(token), confirmar])).rows,
    );
  } catch (e) {
    const valores = { email: r.data.email, cargo: r.data.cargo ?? "", nivel };
    if ((e as Error).message === "confirmar_assento") return { erro: mensagemDeErro(e), confirmarAssento: true, valores };
    return { erro: mensagemDeErro(e), valores };
  }
  refresh();
  if (linha.aguarda_titular) return { ok: "Não há assento livre: o convite fica guardado até o Titular confirmar mais um assento." };
  if (confirmar) await somarAssento(s).catch((e) => console.error("assento", e));
  return enviarConvite(s, r.data.email, nivel, token);
}

export async function reenviarConvite(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("gerir_pessoas");
  const token = novoToken();
  try {
    const { email, nivel } = await noEscritorio(s, async (c) => {
      const e = (await c.query(`select app.reenviar_convite($1, $2) e`, [form.get("id"), hashToken(token)])).rows[0].e;
      const n = (await c.query(`select nivel from convites where id = $1`, [form.get("id")])).rows[0].nivel;
      return { email: e, nivel: n };
    });
    refresh();
    return enviarConvite(s, email, nivel, token);
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
}

export async function cancelarConvite(form: FormData): Promise<void> {
  const s = await exigirPermissao("gerir_pessoas");
  await noEscritorio(s, (c) => c.query(`select app.cancelar_convite($1)`, [form.get("id")]));
  refresh();
}

/** O Titular libera o convite que um Admin fez acima dos assentos. */
export async function liberarConvite(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("gerir_cobranca");
  const token = novoToken();
  try {
    const { email, nivel } = await noEscritorio(s, async (c) => {
      const e = (await c.query(`select app.liberar_convite($1, $2) e`, [form.get("id"), hashToken(token)])).rows[0].e;
      const n = (await c.query(`select nivel from convites where id = $1`, [form.get("id")])).rows[0].nivel;
      return { email: e, nivel: n };
    });
    await somarAssento(s).catch((e) => console.error("assento", e));
    refresh();
    return enviarConvite(s, email, nivel, token);
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
}

export async function mudarNivel(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("gerir_pessoas");
  const nivel = form.get("nivel");
  if (!nivelValido(nivel)) return { erro: "Escolha o nível." };
  try {
    await noEscritorio(s, (c) => c.query(`select app.mudar_nivel($1, $2)`, [form.get("usuario"), nivel]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: `Nível alterado para ${ROTULO_NIVEL[nivel]}.` };
}

export async function mudarCargo(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("gerir_pessoas");
  const cargo = String(form.get("cargo") ?? "").trim().slice(0, 80);
  await noEscritorio(s, (c) => c.query(`update membros set cargo = $1 where escritorio_id = $2 and usuario_id = $3`, [cargo || null, s.escritorioId, form.get("usuario")]));
  refresh();
  return { ok: "Cargo salvo." };
}

export async function suspender(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("gerir_pessoas");
  const suspender = form.get("suspender") === "1";
  try {
    await noEscritorio(s, (c) => c.query(`select app.suspender($1, $2)`, [form.get("usuario"), suspender]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: suspender ? "Acesso suspenso. As sessões da pessoa caíram." : "Acesso reativado." };
}

export async function remover(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("gerir_pessoas");
  try {
    await noEscritorio(s, (c) => c.query(`select app.remover_membro($1)`, [form.get("usuario")]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: "Pessoa removida. As consultas dela continuam com o escritório." };
}

export async function decidirEntrada(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("gerir_pessoas");
  const aprovar = form.get("aprovar") === "1";
  const nivel = form.get("nivel") ?? "supervisionado";
  if (aprovar && !nivelValido(nivel)) return { erro: "Escolha o nível." };
  try {
    await noEscritorio(s, (c) => c.query(`select app.decidir_entrada($1, $2, $3, $4)`, [form.get("id"), aprovar, nivel, form.get("cargo") || null]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: aprovar ? "Entrada aprovada." : "Pedido recusado." };
}

// ── Configurações ──

const Config = z.object({
  nome: z.string().trim().min(2, "Informe o nome do escritório.").max(160),
  exige_2fa: z.enum(["nao", "admins", "todos"]),
  sessao_horas: z.coerce.number().int().min(1).max(720),
  dominio_email: z.string().trim().toLowerCase().max(120).regex(/^([a-z0-9.-]+\.[a-z]{2,})?$/, "Domínio inválido. Exemplo: escritorio.adv.br").optional(),
});

export async function salvarConfiguracoes(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("configurar_escritorio");
  const r = Config.safeParse(Object.fromEntries(["nome", "exige_2fa", "sessao_horas", "dominio_email"].map((k) => [k, form.get(k) ?? undefined])));
  if (!r.success) return { erro: r.error.issues[0]?.message };
  try {
    await noEscritorio(s, async (c) => {
      const antes = (await c.query(`select nome, exige_2fa, sessao_horas, dominio_email from escritorios where id = $1`, [s.escritorioId])).rows[0];
      await c.query(`update escritorios set nome = $1, exige_2fa = $2, sessao_horas = $3, dominio_email = $4 where id = $5`, [
        r.data.nome, r.data.exige_2fa, r.data.sessao_horas, r.data.dominio_email || null, s.escritorioId,
      ]);
      const mudou = Object.fromEntries(Object.entries(r.data).filter(([k, v]) => String(antes[k] ?? "") !== String(v ?? "")));
      if (Object.keys(mudou).length) {
        await c.query(`insert into auditoria (escritorio_id, usuario_id, acao, detalhes) values ($1, $2, 'configuracao', $3)`, [s.escritorioId, s.usuarioId, JSON.stringify(mudou)]);
      }
    });
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  refresh();
  return { ok: "Configurações salvas." };
}

/** Logo do cabeçalho do parecer, já reduzido no navegador. */
export async function salvarLogo(dataUrl: string | null): Promise<Resultado> {
  const s = await exigirPermissao("configurar_escritorio");
  if (dataUrl && (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(dataUrl) || dataUrl.length > 300_000)) {
    return { erro: "Envie uma imagem PNG, JPEG, WebP ou SVG de até 200 KB." };
  }
  await noEscritorio(s, async (c) => {
    await c.query(`update escritorios set logo_url = $1 where id = $2`, [dataUrl, s.escritorioId]);
    await c.query(`insert into auditoria (escritorio_id, usuario_id, acao, detalhes) values ($1, $2, 'configuracao', '{"logo": true}')`, [s.escritorioId, s.usuarioId]);
  });
  refresh();
  return { ok: dataUrl ? "Logo salvo." : "Logo removido." };
}

// ── Plano e cobrança (só Titular) ──

function voltaEscritorio(): string {
  return urlPublica("/app/escritorio");
}

export async function assinar(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("gerir_cobranca");
  if (!stripeConfigurado()) return { erro: "A cobrança ainda não foi configurada neste ambiente." };
  const plano = form.get("plano") as Plano;
  if (!PLANOS.includes(plano) || !precoDoPlano(plano)) return { erro: "Escolha um plano." };
  const [c] = await noEscritorio(s, async (x) => (await x.query(`select * from app.cobranca()`)).rows);
  let cliente = c.stripe_cliente_id as string | null;
  if (!cliente) {
    cliente = (await criarCliente(s.escritorioId, s.escritorio, s.email)).id;
    await noEscritorio(s, (x) => x.query(`select app.stripe_vincular_cliente($1)`, [cliente]));
  }
  const { url } = await criarCheckout({ cliente, plano, assentos: Math.max(1, c.em_uso), volta: voltaEscritorio() });
  await noEscritorio(s, (x) => x.query(`select app.registrar_cobranca('assinatura_iniciada', $1)`, [JSON.stringify({ plano, assentos: c.em_uso })]));
  redirect(url);
}

export async function abrirPortal(): Promise<void> {
  const s = await exigirPermissao("gerir_cobranca");
  const [c] = await noEscritorio(s, async (x) => (await x.query(`select * from app.cobranca()`)).rows);
  if (!stripeConfigurado() || !c?.stripe_cliente_id) redirect("/app/escritorio?aba=plano");
  const { url } = await criarPortal(c.stripe_cliente_id, voltaEscritorio());
  redirect(url);
}

// ── Dados e encerramento (só Titular) ──

async function senhaConfere(s: Sessao, senha: string): Promise<boolean> {
  const h = await noEscritorio(s, async (c) => (await c.query(`select app.minha_senha_hash() h`)).rows[0].h);
  return conferirSenha(senha, h);
}

export async function transferirTitularidade(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("transferir_titularidade");
  if (!(await senhaConfere(s, String(form.get("senha") ?? "")))) return { erro: "A senha não confere." };
  try {
    await noEscritorio(s, (c) => c.query(`select app.transferir_titularidade($1)`, [form.get("usuario")]));
  } catch (e) {
    return { erro: mensagemDeErro(e) };
  }
  redirect("/app/escritorio?aba=pessoas");
}

export async function encerrarEscritorio(_: Resultado, form: FormData): Promise<Resultado> {
  const s = await exigirPermissao("encerrar_escritorio");
  if (String(form.get("confirmacao") ?? "").trim() !== s.escritorio) return { erro: "Digite o nome do escritório exatamente como aparece." };
  if (!(await senhaConfere(s, String(form.get("senha") ?? "")))) return { erro: "A senha não confere." };
  await noEscritorio(s, (c) => c.query(`select app.encerrar_escritorio()`));
  refresh();
  return { ok: "Conta encerrada. Você tem 30 dias para exportar os dados ou reabrir." };
}

export async function reabrirEscritorio(): Promise<void> {
  const s = await exigirSessao();
  if (!s.pode.has("encerrar_escritorio")) return;
  await noEscritorio(s, (c) => c.query(`select app.reabrir_escritorio()`));
  refresh();
}

/** Sair da área depois de encerrar, se o Titular quiser. */
export async function sairDepoisDeEncerrar(): Promise<void> {
  await encerrarSessao();
  redirect("/entrar");
}
