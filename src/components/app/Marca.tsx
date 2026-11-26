import Link from "next/link";

/** Símbolo do app: o mesmo da demonstração da landing (marinho com traço dourado). */
export function Simbolo({ claro = false }: { claro?: boolean }) {
  return (
    <svg className="simbolo-app" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="9" fill={claro ? "#d9bf86" : "#0f2742"} />
      <path d="M8 19.5h12M9.5 17V11.5M14 17V11.5M18.5 17V11.5M7.5 10 14 6.5l6.5 3.5" stroke={claro ? "#0f2742" : "#d9bf86"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Marca do app. `claro` para fundo marinho (tela de acesso). */
export function Marca({ href = "/", claro = false }: { href?: string; claro?: boolean }) {
  return (
    <Link href={href} className={`app-marca${claro ? " clara" : ""}`} aria-label="AdvFin">
      <Simbolo claro={claro} />
      <span>Adv<i>Fin</i></span>
    </Link>
  );
}
