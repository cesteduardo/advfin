import type { ReactNode } from "react";

/* Ícones de traço simples, no mesmo desenho das abas da demonstração da landing. */
const ICONES = {
  inicio: <><path d="M4.5 11 12 4.5l7.5 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-4v-5.5h-4V20H6a1.5 1.5 0 0 1-1.5-1.5Z" /></>,
  pesquisa: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  calculo: <><rect x="5" y="3.5" width="14" height="17" rx="3" /><path d="M8.5 8h7M8.5 12.5h1.5M14 12.5h1.5M8.5 16.5h1.5M14 16.5h1.5" /></>,
  classificacao: <><path d="M4 7h16M4 12h10M4 17h6" /><circle cx="17.5" cy="16" r="2.5" /></>,
  auditoria: <><path d="M12 3.5 5 6.5v5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9v-5Z" /><path d="m9 12 2 2 4-4" /></>,
  enviar: <><path d="M12 19V5M6 11l6-6 6 6" /></>,
} satisfies Record<string, ReactNode>;

export type NomeIcone = keyof typeof ICONES;

export function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONES[nome]}
    </svg>
  );
}
