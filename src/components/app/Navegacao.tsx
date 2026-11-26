"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sair } from "@/lib/auth/acoes";
import { Marca } from "./Marca";

const I = {
  inicio: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  pesquisa: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></>,
  calculo: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.5 7.5h7M8.5 12h1M12 12h1M15.5 12h0M8.5 15.5h1M12 15.5h1M15.5 15.5v0" /></>,
  classificacao: <><path d="M4 7h16M4 12h10M4 17h6" /><circle cx="17.5" cy="16" r="2.5" /></>,
};

const LINKS = [
  { href: "/app", nome: "Início", icone: I.inicio },
  { href: "/app/pesquisa", nome: "Pesquisa", icone: I.pesquisa },
  { href: "/app/calculo", nome: "Cálculo", icone: I.calculo },
  { href: "/app/classificacao", nome: "NCM/NBS", icone: I.classificacao },
];

function Icone({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function Navegacao({ nome, escritorio }: { nome: string; escritorio: string }) {
  const caminho = usePathname();
  const atual = (href: string) => (href === "/app" ? caminho === "/app" : caminho.startsWith(href)) ? "page" : undefined;
  return (
    <>
      <aside className="lateral">
        <Marca href="/app" />
        <nav aria-label="Ferramentas">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={atual(l.href)}>
              <Icone>{l.icone}</Icone>
              {l.nome}
            </Link>
          ))}
        </nav>
        <div className="lateral-pe">
          <span>
            <strong>{nome}</strong>
            <br />
            {escritorio}
          </span>
          <form action={sair}>
            <button>Sair</button>
          </form>
        </div>
      </aside>
      <header className="topo-movel">
        <div className="linha">
          <Marca href="/app" />
          <form action={sair}>
            <button>Sair</button>
          </form>
        </div>
        <nav aria-label="Ferramentas">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={atual(l.href)}>
              {l.nome}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
