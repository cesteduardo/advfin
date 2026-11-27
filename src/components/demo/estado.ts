"use client";

import { useSyncExternalStore } from "react";
import type { Nivel } from "@/lib/auth/niveis";

/*
 * Estado da demonstração estática (GitHub Pages): o escritório inteiro mora no localStorage
 * deste navegador. Quem abre entra como Titular, com tudo de administrador: perfil, escritório,
 * pessoas, casos, configurações e auditoria. Nada sai do navegador.
 */

export interface PessoaDemo {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  nivel: Nivel;
  situacao: "ativo" | "convidado" | "suspenso";
  desde: string;
}
export interface CasoDemo {
  id: string;
  titulo: string;
  cliente: string;
  autor: string;
  criadoEm: string;
  incluidos: string[];
}
export interface ConsultaDemo {
  id: string;
  pergunta: string;
  data: string;
  caso: string | null;
  status: string;
  criadoEm: string;
}
export interface EventoDemo {
  id: string;
  acao: string;
  detalhe: string;
  quem: string;
  em: string;
}
export interface EstadoDemo {
  versao: 1;
  eu: string;
  perfil: { oab: string; uf: string; foto: string | null; vigencia: string };
  escritorio: { nome: string; logo: string | null; exige2fa: "nao" | "admins" | "todos"; dominio: string; sessaoHoras: number };
  pessoas: PessoaDemo[];
  casos: CasoDemo[];
  consultas: ConsultaDemo[];
  auditoria: EventoDemo[];
}

const CHAVE = "advfin-demo-v1";
const ouvintes = new Set<() => void>();
let cache: EstadoDemo | null | undefined;

function ler(): EstadoDemo | null {
  if (cache !== undefined) return cache;
  try {
    const bruto = localStorage.getItem(CHAVE);
    cache = bruto ? (JSON.parse(bruto) as EstadoDemo) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function gravar(e: EstadoDemo | null) {
  cache = e;
  try {
    if (e) localStorage.setItem(CHAVE, JSON.stringify(e));
    else localStorage.removeItem(CHAVE);
  } catch {
    // Sem espaço ou navegação privada: a demonstração segue só na memória.
  }
  ouvintes.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (ev) => {
    if (ev.key !== CHAVE) return;
    cache = undefined;
    ouvintes.forEach((f) => f());
  });
}

/** undefined = ainda carregando (pré-renderização); null = ninguém criou o escritório ainda. */
export function useDemo(): EstadoDemo | null | undefined {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    ler,
    () => undefined,
  );
}

export const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
export const agora = () => new Date().toISOString();

/** Muda o estado e registra a ação na auditoria, como o app de verdade faz. */
export function alterar(fn: (e: EstadoDemo) => EstadoDemo, acao?: string, detalhe = "") {
  const e = ler();
  if (!e) return;
  let novo = fn(structuredClone(e));
  if (acao) novo = { ...novo, auditoria: [{ id: novoId(), acao, detalhe, quem: e.eu, em: agora() }, ...novo.auditoria].slice(0, 300) };
  gravar(novo);
}

export function apagarDemo() {
  gravar(null);
}

export function criarDemo(d: { nome: string; email: string; cargo: string; oab: string; uf: string; escritorio: string; dominio: string; exemplo: boolean }) {
  const eu: PessoaDemo = { id: novoId(), nome: d.nome, email: d.email, cargo: d.cargo, nivel: "titular", situacao: "ativo", desde: agora() };
  const dominio = d.dominio || d.email.split("@")[1] || "escritorio.adv.br";
  const equipe: PessoaDemo[] = d.exemplo
    ? [
        { id: novoId(), nome: "Pessoa Administradora", email: `admin@${dominio}`, cargo: "Gestão", nivel: "admin", situacao: "ativo", desde: agora() },
        { id: novoId(), nome: "Advogada Associada", email: `associada@${dominio}`, cargo: "Associada", nivel: "membro", situacao: "ativo", desde: agora() },
        { id: novoId(), nome: "Estagiário de Direito", email: `estagio@${dominio}`, cargo: "Estagiário", nivel: "supervisionado", situacao: "ativo", desde: agora() },
      ]
    : [];
  gravar({
    versao: 1,
    eu: eu.id,
    perfil: { oab: d.oab, uf: d.uf, foto: null, vigencia: "hoje" },
    escritorio: { nome: d.escritorio, logo: null, exige2fa: "nao", dominio: d.dominio, sessaoHoras: 336 },
    pessoas: [eu, ...equipe],
    casos: [],
    consultas: [],
    auditoria: [{ id: novoId(), acao: "cadastro", detalhe: `${d.escritorio} criado`, quem: eu.id, em: agora() }],
  });
}

export const euDe = (e: EstadoDemo) => e.pessoas.find((p) => p.id === e.eu)!;
export const nomeDe = (e: EstadoDemo, id: string) => e.pessoas.find((p) => p.id === id)?.nome ?? "ex-membro";
