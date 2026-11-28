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
  preferencias: <><path d="M5 7h9M18 7h1M5 12h3M12 12h7M5 17h11M20 17h-1" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="17" r="2" /></>,
  baixar: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" /></>,
  seguranca: <><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /><path d="M12 14.5v2" /></>,
  privacidade: <><path d="M3.5 12s3-6 8.5-6 8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  convidar: <><circle cx="10" cy="8.5" r="3.2" /><path d="M4 19c.7-3.2 3-5 6-5s5.3 1.8 6 5" /><path d="M18.5 7.5v5M16 10h5" /></>,
  configuracoes: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" /></>,
  consumo: <><path d="M4.5 16.5a7.5 7.5 0 1 1 15 0" /><path d="m12 16.5 3.5-4.5" /><path d="M4.5 19.5h15" /></>,
  plano: <><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M3.5 10h17M7 14.5h4" /></>,
  arquivo: <><rect x="4" y="5" width="16" height="4" rx="1.2" /><path d="M5.5 9v8.5A1.5 1.5 0 0 0 7 19h10a1.5 1.5 0 0 0 1.5-1.5V9M10 12.5h4" /></>,
  tempo: <><path d="M4 19.5h16" /><path d="M7 16.5v-4M12 16.5V8M17 16.5v-6" /></>,
  comparador: <><path d="M12 4.5v15M7 19.5h10M5 8h14" /><path d="m5 8-2.5 5.5a3 3 0 0 0 5 0Zm14 0-2.5 5.5a3 3 0 0 0 5 0Z" /></>,
  apuracao: <><path d="M6 3.5h12v17l-2.5-1.6-2 1.6-1.5-1.2-1.5 1.2-2-1.6L6 20.5Z" /><path d="M9 8.5h6M9 12h6M9 15.5h3" /></>,
  curadoria: <><path d="M5 6.5h2M5 12h2M5 17.5h2M10 6.5h9M10 12h9M10 17.5h5" /></>,
  selo: <><circle cx="12" cy="9.5" r="5" /><path d="m9.5 13.8-1.5 6 4-2 4 2-1.5-6" /></>,
  predio: <><path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V20M15 10h3.5a1.5 1.5 0 0 1 1.5 1.5V20M3.5 20h17M8.5 8h3M8.5 11.5h3M8.5 15h3" /></>,
  mais: <><path d="M12 5v14M5 12h14" /></>,
  microfone: <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></>,
  voz: <><path d="M4 10.5v3M8 7.5v9M12 4.5v15M16 8v8M20 10.5v3" /></>,
  documento: <><path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5Z" /><path d="M14 3.5v4h4M9 12.5h6M9 16h4" /></>,
  imagem: <><rect x="4" y="5" width="16" height="14" rx="2.5" /><circle cx="9.5" cy="10" r="1.6" /><path d="m4.5 17 4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" /></>,
  fechar: <><path d="M7 7l10 10M17 7 7 17" /></>,
  copiar: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  editar: <><path d="M14.5 5.5 18.5 9.5M4.5 19.5l1-4.5 10-10a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2l-10 10Z" /></>,
  refazer: <><path d="M19 12a7 7 0 1 1-2.1-5" /><path d="M19 4.5V9h-4.5" /></>,
  ok: <><path d="m5.5 12.5 4 4 9-9" /></>,
  parar: <><rect x="7" y="7" width="10" height="10" rx="2" /></>,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" /></>,
  lua: <><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" /></>,
  automatico: <><circle cx="12" cy="12" r="8" /><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" /></>,
} satisfies Record<string, ReactNode>;

export type NomeIcone = keyof typeof ICONES;

export function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONES[nome]}
    </svg>
  );
}
