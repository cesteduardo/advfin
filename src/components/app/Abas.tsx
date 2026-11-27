"use client";

import { DockSecoes } from "./DockSecoes";

/**
 * Seções de uma tela como dock no estilo do macOS. Cada seção é um endereço (?aba=...):
 * dá para voltar, recarregar e mandar o link de uma seção.
 */
export function Abas({ base, abas, atual, rotulo }: { base: string; abas: { id: string; nome: string; conta?: number }[]; atual: string; rotulo: string }) {
  return <DockSecoes base={base} itens={abas} atual={atual} rotulo={rotulo} />;
}
