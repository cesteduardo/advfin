import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { consultar } from "@/lib/db";
import type { Acao, Nivel } from "./niveis";
import { hashToken, novoToken } from "./senha";

export const COOKIE_SESSAO = "advfin_sessao";
export const COOKIE_DESAFIO = "advfin_desafio";
const DIAS = 14;

export interface Preferencias {
  /** "hoje" ou uma data AAAA-MM-DD para casos antigos. */
  vigencia?: string;
  avisos?: { convites?: boolean; revisoes?: boolean; resumo?: boolean };
}

export interface Sessao {
  usuarioId: string;
  escritorioId: string;
  sessaoId: string;
  nome: string;
  email: string;
  escritorio: string;
  nivel: Nivel;
  cargo: string | null;
  foto: string | null;
  logo: string | null;
  /** O escritório exige 2FA para o nível da pessoa e ela ainda não ativou. */
  precisa2fa: boolean;
  encerradoEm: Date | null;
  plataforma: "admin" | "curador" | "suporte" | null;
  preferencias: Preferencias;
  /** Ações livres e com revisão para o nível, resolvidas pelo banco (app.permissoes). */
  pode: ReadonlySet<Acao>;
  comRevisao: ReadonlySet<Acao>;
}

/** A matriz é fixa por migração: lida uma vez por processo. */
let matriz: Promise<Map<Nivel, { pode: Set<Acao>; revisao: Set<Acao> }>> | null = null;
function lerMatriz() {
  matriz ??= consultar<{ acao: Acao; nivel: Nivel; efeito: string }>(`select acao, nivel, efeito from app.permissoes`)
    .then((linhas) => {
      const m = new Map<Nivel, { pode: Set<Acao>; revisao: Set<Acao> }>();
      for (const l of linhas) {
        const n = m.get(l.nivel) ?? { pode: new Set(), revisao: new Set() };
        (l.efeito === "pode" ? n.pode : n.revisao).add(l.acao);
        m.set(l.nivel, n);
      }
      return m;
    })
    .catch((e) => {
      matriz = null;
      throw e;
    });
  return matriz;
}

/** "Firefox no Linux", "Safari no iPhone": o bastante para a pessoa reconhecer o aparelho. */
export function descreverAparelho(ua: string | null): string | null {
  if (!ua) return null;
  const nav = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const so = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  return so ? `${nav} no ${so}` : nav;
}

async function origemDaRequisicao(): Promise<{ aparelho: string | null; cidade: string | null }> {
  const h = await headers();
  const cidade = h.get("x-vercel-ip-city") ?? h.get("cf-ipcity");
  return { aparelho: descreverAparelho(h.get("user-agent")), cidade: cidade ? decodeURIComponent(cidade) : null };
}

const opcoesCookie = (segundos: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: segundos,
});

export async function abrirSessao(usuarioId: string, escritorioId: string): Promise<void> {
  const token = novoToken();
  const { aparelho, cidade } = await origemDaRequisicao();
  await consultar(`select app.criar_sessao($1, $2, $3, $4, $5, $6)`, [hashToken(token), usuarioId, escritorioId, DIAS, aparelho, cidade]);
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, opcoesCookie(DIAS * 24 * 60 * 60));
  jar.delete(COOKIE_DESAFIO);
}

/** Hash do token da sessão atual, para marcar "este aparelho" e não derrubá-lo. */
export async function hashSessaoAtual(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  return token ? hashToken(token) : null;
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) await consultar(`select app.encerrar_sessao($1)`, [hashToken(token)]);
  jar.delete(COOKIE_SESSAO);
}

/** Segundo passo do login: a senha conferiu, falta o código. Vale 5 minutos. */
export async function abrirDesafio(usuarioId: string, escritorioId: string): Promise<void> {
  const token = novoToken();
  await consultar(`select app.desafio_criar($1, $2, $3)`, [hashToken(token), usuarioId, escritorioId]);
  (await cookies()).set(COOKIE_DESAFIO, token, opcoesCookie(5 * 60));
}

export async function hashDesafio(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_DESAFIO)?.value;
  return token ? hashToken(token) : null;
}

/** Sessão da requisição atual (memorizada por requisição). */
export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const [l] = await consultar(`select * from app.resolver_sessao($1)`, [hashToken(token)]);
  if (!l) return null;
  const m = (await lerMatriz()).get(l.nivel);
  return {
    usuarioId: l.usuario_id,
    escritorioId: l.escritorio_id,
    sessaoId: l.sessao_id,
    nome: l.nome,
    email: l.email,
    escritorio: l.escritorio,
    nivel: l.nivel,
    cargo: l.cargo,
    foto: l.foto_url,
    logo: l.logo_url,
    precisa2fa: l.precisa_2fa,
    encerradoEm: l.encerrado_em,
    plataforma: l.plataforma,
    preferencias: l.preferencias ?? {},
    pode: m?.pode ?? new Set(),
    comRevisao: m?.revisao ?? new Set(),
  };
});

/** Para páginas e ações da área logada: sem sessão válida, volta ao login. */
export async function exigirSessao(): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  return s;
}

/**
 * Página ou ação que pede uma permissão. A tela some (404) para quem não a tem, como o
 * laboratório já fazia; o banco recusa de novo, pela RLS, se algo passar daqui.
 */
export async function exigirPermissao(acao: Acao): Promise<Sessao> {
  const s = await exigirSessao();
  if (!s.pode.has(acao)) notFound();
  return s;
}

export async function exigirPlataforma(papeis: ("admin" | "curador" | "suporte")[] = []): Promise<Sessao> {
  const s = await exigirSessao();
  if (!s.plataforma || (s.plataforma !== "admin" && !papeis.includes(s.plataforma))) notFound();
  return s;
}

/** Data de vigência padrão da pessoa: hoje, ou a data fixa escolhida no perfil. */
export function vigenciaPadrao(p: Preferencias): string {
  if (p.vigencia && /^\d{4}-\d{2}-\d{2}$/.test(p.vigencia)) return p.vigencia;
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
