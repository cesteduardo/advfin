"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AgendaReforma } from "@/components/app/AgendaReforma";
import { Icone, type NomeIcone } from "@/components/app/Icone";
import { euDe, useDemo } from "./estado";

const quando = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/**
 * Início: o resumo do escritório. Números do dia, a agenda da Reforma com o próximo marco,
 * casos e consultas recentes. A pesquisa em si é o chat, em página própria.
 */
export function InicioDemo() {
  const e = useDemo();
  const [saudacao, setSaudacao] = useState("Olá");
  const [hojeTxt, setHojeTxt] = useState("");
  useEffect(() => {
    const agora = new Date();
    const h = Number(agora.toLocaleTimeString("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).slice(0, 2));
    setSaudacao(h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite");
    setHojeTxt(agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }));
  }, []);
  if (!e) return null;
  const primeiro = euDe(e).nome.split(" ")[0];
  const semana = Date.now() - 7 * 86_400_000;
  const convites = e.pessoas.filter((p) => p.situacao === "convidado").length;
  const numeros: { rotulo: string; valor: number; nota: string; href: string; icone: NomeIcone }[] = [
    { rotulo: "Consultas", valor: e.consultas.length, nota: `${e.consultas.filter((c) => Date.parse(c.criadoEm) > semana).length} nesta semana`, href: "/app/pesquisa", icone: "pesquisa" },
    { rotulo: "Casos", valor: e.casos.length, nota: e.casos.length ? `último: ${e.casos[0].titulo}` : "nenhum aberto", href: "/app/casos", icone: "casos" },
    { rotulo: "Pessoas", valor: e.pessoas.filter((p) => p.situacao !== "convidado").length, nota: convites ? `${convites} convite${convites > 1 ? "s" : ""} pendente${convites > 1 ? "s" : ""}` : "sem convites pendentes", href: "/app/escritorio", icone: "escritorio" },
  ];

  return (
    <>
      <header className="inicio-cabeca mesa-entra">
        <div>
          <p className="mesa-trilha">{e.escritorio.nome}{hojeTxt && ` · ${hojeTxt}`}</p>
          <h1>{saudacao}, {primeiro}.</h1>
          <p className="mesa-descricao">O resumo do escritório e o que muda na Reforma. Para perguntar, abra o chat.</p>
        </div>
        <Link href="/app/pesquisa" className="mesa-botao inicio-chat">
          <Icone nome="pesquisa" /> Abrir o chat
        </Link>
      </header>

      <div className="inicio-numeros">
        {numeros.map((n, i) => (
          <Link key={n.rotulo} href={n.href} className="inicio-numero mesa-entra" style={{ "--i": i + 1 } as React.CSSProperties}>
            <span className="inicio-numero-topo"><Icone nome={n.icone} />{n.rotulo}</span>
            <strong>{n.valor}</strong>
            <span className="inicio-numero-nota">{n.nota}</span>
          </Link>
        ))}
      </div>

      <div className="inicio-grade">
        <AgendaReforma />
        <div className="inicio-coluna">
          <section className="mesa-cartao mesa-entra" style={{ "--i": 4 } as React.CSSProperties} aria-labelledby="ini-consultas">
            <div className="inicio-cartao-topo">
              <h2 id="ini-consultas">Consultas recentes</h2>
              <Link href="/app/pesquisa" className="inicio-ver">Nova consulta</Link>
            </div>
            {e.consultas.length === 0 ? (
              <p className="mesa-vazio-cartao">Nenhuma consulta ainda. Pergunte no chat e ela aparece aqui.</p>
            ) : (
              <ul className="inicio-lista">
                {e.consultas.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <span>{c.pergunta}</span>
                    <small>{c.status} · {quando(c.criadoEm)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="mesa-cartao mesa-entra" style={{ "--i": 5 } as React.CSSProperties} aria-labelledby="ini-casos">
            <div className="inicio-cartao-topo">
              <h2 id="ini-casos">Casos</h2>
              <Link href="/app/casos" className="inicio-ver">Ver todos</Link>
            </div>
            {e.casos.length === 0 ? (
              <p className="mesa-vazio-cartao">Nenhum caso aberto. Crie um para guardar consultas e pareceres de um cliente.</p>
            ) : (
              <ul className="inicio-lista">
                {e.casos.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <span>{c.titulo}</span>
                    <small>{c.cliente} · {c.incluidos.length} {c.incluidos.length === 1 ? "pessoa" : "pessoas"}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
