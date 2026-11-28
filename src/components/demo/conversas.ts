"use client";

import { useEffect, useState } from "react";
import type { TurnoSalvo } from "@/components/app/PesquisaMesa";

/**
 * Conversas da demonstração: cada pesquisa guarda perguntas, respostas, fontes e datas
 * neste navegador, para reabrir do caso e continuar dali. Fica fora do estado principal
 * porque as fontes pesam; guarda as 60 mais recentes.
 */
export interface ConversaDemo {
  id: string;
  caso: string | null;
  turnos: TurnoSalvo[];
  criadaEm: string;
  atualizadaEm: string;
}

const CHAVE = "advfin-demo-conversas";
const EVENTO = "advfin-conversas";
const MAX = 60;

export function lerConversas(): ConversaDemo[] {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export function lerConversa(id: string): ConversaDemo | undefined {
  return lerConversas().find((c) => c.id === id);
}

export function guardarConversa(c: Omit<ConversaDemo, "criadaEm" | "atualizadaEm">) {
  const todas = lerConversas();
  const antiga = todas.find((x) => x.id === c.id);
  const agora = new Date().toISOString();
  const nova: ConversaDemo = { ...c, criadaEm: antiga?.criadaEm ?? agora, atualizadaEm: agora };
  let lista = [nova, ...todas.filter((x) => x.id !== c.id)].slice(0, MAX);
  // Navegador cheio: solta as mais antigas até caber.
  for (;;) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(lista));
      break;
    } catch {
      if (lista.length <= 1) break;
      lista = lista.slice(0, Math.ceil(lista.length / 2));
    }
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Conversas de um caso, mais recentes primeiro; atualiza quando outra tela grava. */
export function useConversas(caso?: string | null) {
  const [lista, setLista] = useState<ConversaDemo[]>([]);
  useEffect(() => {
    const ler = () => setLista(lerConversas().filter((c) => caso === undefined || c.caso === caso));
    ler();
    window.addEventListener(EVENTO, ler);
    window.addEventListener("storage", ler);
    return () => {
      window.removeEventListener(EVENTO, ler);
      window.removeEventListener("storage", ler);
    };
  }, [caso]);
  return lista;
}
