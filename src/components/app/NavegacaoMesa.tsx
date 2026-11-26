"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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

/**
 * Menu lateral da mesa de trabalho (desktop) e abas em pílula de vidro (celular), como na demonstração.
 * `acao` é o botão do cartão do usuário: Sair no app, o caminho de volta na demonstração estática.
 */
export function NavegacaoMesa({
  nome,
  escritorio,
  recentes,
  dev,
  acao,
}: {
  nome: string;
  escritorio: string;
  recentes: ConsultaRecente[];
  dev: boolean;
  acao: ReactNode;
}) {
  const caminho = usePathname();
  const ativo = (href: string) => (href === "/app" ? caminho === "/app" : caminho.startsWith(href));
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <>
      <aside className="mesa-lateral">
        <Marca href="/app" />
        <nav aria-label="Ferramentas">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={ativo(l.href) ? "ativo" : undefined} aria-current={ativo(l.href) ? "page" : undefined}>
              <Icone nome={l.icone} />
              {l.nome}
            </Link>
          ))}
          {dev && (
            <Link href="/app/dev" className={ativo("/app/dev") ? "ativo" : undefined} aria-current={ativo("/app/dev") ? "page" : undefined}>
              <Icone nome="auditoria" />
              Laboratório
            </Link>
          )}
        </nav>
        <p className="mesa-rotulo">Consultas recentes</p>
        {recentes.length ? (
          <ul>
            {recentes.map((r) => (
              <li key={r.id} title={r.pergunta}>{r.pergunta}</li>
            ))}
          </ul>
        ) : (
          <p className="mesa-vazio">Suas perguntas aparecem aqui.</p>
        )}
        <div className="mesa-usuario">
          <span>
            <strong>{nome}</strong>
            {escritorio}
          </span>
          {acao}
        </div>
      </aside>

      <header className="app-topo mesa-topo-movel">
        <Marca href="/app" />
        <span className="app-data">Vigência {hoje}</span>
      </header>
      <nav className="app-abas mesa-abas" aria-label="Ferramentas">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={ativo(l.href) ? "ativo" : undefined} aria-current={ativo(l.href) ? "page" : undefined}>
            <Icone nome={l.icone} />
            {l.curto}
          </Link>
        ))}
      </nav>
    </>
  );
}
