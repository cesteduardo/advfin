"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Dica } from "@/components/ui/Dica";
import { Dock, ativoEm } from "./Dock";
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
      <aside className="mesa-lateral">
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

      <header className="app-topo mesa-topo-movel">
        <Marca href="/app" />
        {perfilHref ? (
          <Link href={perfilHref} className="mesa-topo-perfil" aria-label="Perfil e escritório">
            <Avatar nome={nome} foto={foto} />
          </Link>
        ) : (
          <span className="app-data">Vigência {hoje}</span>
        )}
      </header>
      <Dock links={LINKS} />
    </>
  );
}
