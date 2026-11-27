"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Dica } from "@/components/ui/Dica";
import { ativoEm } from "./Dock";
import { Icone, type NomeIcone } from "./Icone";
import { Marca } from "./Marca";

const LINKS: { href: string; nome: string; curto: string; icone: NomeIcone }[] = [
  { href: "/app", nome: "Início", curto: "Início", icone: "inicio" },
  { href: "/app/pesquisa", nome: "Pesquisa", curto: "Pesquisa", icone: "pesquisa" },
  { href: "/app/calculo", nome: "Calculadora", curto: "Cálculo", icone: "calculo" },
  { href: "/app/classificacao", nome: "NCM/NBS", curto: "NCM/NBS", icone: "classificacao" },
];

export interface ConsultaRecente {
  id: string;
  pergunta: string;
}

export interface LinkExtra {
  href: string;
  nome: string;
  icone: NomeIcone;
  /** Número pequeno ao lado (pendências). */
  conta?: number;
}

/** Iniciais para o avatar sem foto. */
function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ nome, foto, grande }: { nome: string; foto?: string | null; grande?: boolean }) {
  return (
    <span className={`avatar${grande ? " avatar-grande" : ""}`} aria-hidden="true">
      {foto ? <img src={foto} alt="" /> : iniciais(nome)}
    </span>
  );
}

/**
 * Menu lateral da mesa de trabalho (desktop) e abas em pílula de vidro (celular), como na demonstração.
 * `acao` é o botão do cartão do usuário: Sair no app, o caminho de volta na demonstração estática.
 * `extras` entram depois das ferramentas (Casos, Escritório, Plataforma, conforme o nível).
 */
export function NavegacaoMesa({
  nome,
  escritorio,
  recentes,
  dev,
  acao,
  extras = [],
  foto,
  perfilHref,
  hrefConsulta,
}: {
  nome: string;
  escritorio: string;
  recentes: ConsultaRecente[];
  dev: boolean;
  acao: ReactNode;
  extras?: LinkExtra[];
  foto?: string | null;
  perfilHref?: string;
  hrefConsulta?: (id: string) => string;
}) {
  const caminho = usePathname();
  const ativo = (href: string) => ativoEm(caminho, href);
  // Celular: o menu lateral vira uma gaveta, como no app do Claude. Fecha ao navegar, com Esc ou no véu.
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [caminho]);
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", esc);
    document.documentElement.classList.add("gaveta-mesa-aberta");
    return () => {
      document.removeEventListener("keydown", esc);
      document.documentElement.classList.remove("gaveta-mesa-aberta");
    };
  }, [menu]);
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const link = (l: { href: string; nome: string; icone: NomeIcone; conta?: number }) => (
    <Link key={l.href} href={l.href} className={ativo(l.href) ? "ativo" : undefined} aria-current={ativo(l.href) ? "page" : undefined}>
      <Icone nome={l.icone} />
      {l.nome}
      {l.conta ? <span className="mesa-conta" aria-label={`${l.conta} pendente${l.conta > 1 ? "s" : ""}`}>{l.conta}</span> : null}
    </Link>
  );

  const usuario = (
    <span className="mesa-usuario-quem">
      {perfilHref && <Avatar nome={nome} foto={foto} />}
      <span>
        <strong>{nome}</strong>
        {escritorio}
      </span>
    </span>
  );

  return (
    <>
      <aside id="mesa-menu" className="mesa-lateral" data-aberto={menu ? "" : undefined}>
        <Marca href="/app" />
        <nav aria-label="Ferramentas">
          {LINKS.map(link)}
          {extras.map(link)}
          {dev && link({ href: "/app/dev", nome: "Laboratório", icone: "auditoria" })}
        </nav>
        <p className="mesa-rotulo">Consultas recentes</p>
        {recentes.length ? (
          <ul>
            {recentes.map((r) => (
              <li key={r.id}>
                <Dica texto={r.pergunta} classe="mesa-recente">
                  {hrefConsulta ? <Link href={hrefConsulta(r.id)}>{r.pergunta}</Link> : r.pergunta}
                </Dica>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mesa-vazio">Suas perguntas aparecem aqui.</p>
        )}
        <div className="mesa-usuario">
          {perfilHref ? (
            <Link href={perfilHref} className="mesa-usuario-perfil" aria-label={`Perfil de ${nome}`}>
              {usuario}
            </Link>
          ) : (
            usuario
          )}
          {acao}
        </div>
      </aside>

      <div className="mesa-veu" aria-hidden="true" onClick={() => setMenu(false)} />
      <header className="app-topo mesa-topo-movel">
        <button type="button" className="mesa-topo-botao" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} aria-controls="mesa-menu" onClick={() => setMenu((v) => !v)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h11M4 17h16" /></svg>
        </button>
        <Marca href="/app" />
        <Link href="/app/pesquisa" className="mesa-topo-botao" aria-label="Nova conversa" title={`Nova conversa · vigência ${hoje}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </Link>
      </header>
    </>
  );
}
