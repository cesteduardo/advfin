"use client";

import Link from "next/link";
import { Cabeca } from "@/components/app/Cabeca";
import { Icone } from "@/components/app/Icone";
import { euDe, useDemo } from "./estado";

const quando = (s: string) => new Date(s).toLocaleDateString("pt-BR");
const ATALHOS = [
  { href: "/app/pesquisa", icone: "pesquisa", titulo: "Pesquisa fundamentada", texto: "Pergunte em linguagem natural e receba a resposta com a fonte ao lado, no que valia na data escolhida." },
  { href: "/app/calculo", icone: "calculo", titulo: "Cálculo da transição", texto: "Linha do tempo 2026–2033, comparador de regimes e apuração com créditos, por motor determinístico." },
  { href: "/app/classificacao", icone: "classificacao", titulo: "Classificação NCM/NBS", texto: "Encontre o regime de IBS/CBS de um produto ou serviço, com o fundamento e o status de conferência." },
  { href: "/app/escritorio", icone: "escritorio", titulo: "Administração do escritório", texto: "Pessoas, níveis de acesso, convites, configurações e a trilha de auditoria." },
] as const;

export function InicioDemo() {
  const e = useDemo();
  if (!e) return null;
  const primeiro = euDe(e).nome.split(" ")[0];
  return (
    <>
      <Cabeca trilha={`${e.escritorio.nome} / Início`} titulo={`Olá, ${primeiro}. O que vamos conferir hoje?`} />
      <div className="atalhos">
        {ATALHOS.map((a, i) => (
          <Link key={a.href} className="atalho mesa-entra" style={{ "--i": i } as React.CSSProperties} href={a.href}>
            <span className="icone"><Icone nome={a.icone} /></span>
            <h2>{a.titulo}</h2>
            <p>{a.texto}</p>
          </Link>
        ))}
      </div>
      <section className="bloco" aria-labelledby="recentes">
        <p className="mesa-rotulo" id="recentes">Consultas recentes do escritório</p>
        {e.consultas.length === 0 ? (
          <p className="mesa-vazio-cartao">Nenhuma consulta ainda. Comece pela pesquisa.</p>
        ) : (
          <ul className="mesa-lista">
            {e.consultas.slice(0, 8).map((c) => (
              <li key={c.id}>
                <span>{c.pergunta}</span>
                <span>
                  {c.status} · {quando(c.criadoEm)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
