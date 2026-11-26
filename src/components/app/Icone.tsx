import type { ReactNode } from "react";

/* Ícones de traço simples, no mesmo desenho das abas da demonstração da landing. */
const ICONES = {
  inicio: <><path d="M4.5 11 12 4.5l7.5 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-4v-5.5h-4V20H6a1.5 1.5 0 0 1-1.5-1.5Z" /></>,
  pesquisa: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  calculo: <><rect x="5" y="3.5" width="14" height="17" rx="3" /><path d="M8.5 8h7M8.5 12.5h1.5M14 12.5h1.5M8.5 16.5h1.5M14 16.5h1.5" /></>,
  classificacao: <><path d="M4 7h16M4 12h10M4 17h6" /><circle cx="17.5" cy="16" r="2.5" /></>,
  auditoria: <><path d="M12 3.5 5 6.5v5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9v-5Z" /><path d="m9 12 2 2 4-4" /></>,
  enviar: <><path d="M12 19V5M6 11l6-6 6 6" /></>,
  casos: <><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z" /></>,
  escritorio: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16.2 14.4c2.3.1 3.8 1.6 4.3 4.1" /></>,
  plataforma: <><path d="m12 4 8 4-8 4-8-4Z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></>,
  perfil: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c.9-3.4 3.6-5.3 7-5.3s6.1 1.9 7 5.3" /></>,
} satisfies Record<string, ReactNode>;

export type NomeIcone = keyof typeof ICONES;

export function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONES[nome]}
    </svg>
  );
}
