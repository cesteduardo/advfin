import Link from "next/link";

export function Marca({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="marca" aria-label="AdvFin">
      <svg className="simbolo" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="9" fill="#d9bf86" />
        <path d="M8 19.5h12M9.5 17V11.5M14 17V11.5M18.5 17V11.5M7.5 10 14 6.5l6.5 3.5" stroke="#0f2742" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span>Adv<i>Fin</i></span>
    </Link>
  );
}
