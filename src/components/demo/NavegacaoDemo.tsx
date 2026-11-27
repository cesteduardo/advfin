"use client";

import Link from "next/link";
import { NavegacaoMesa } from "@/components/app/NavegacaoMesa";
import { euDe, useDemo } from "./estado";

/** Menu da demonstração: a pessoa entra como Titular, então vê Casos e Escritório além das ferramentas. */
export function NavegacaoDemo() {
  const e = useDemo();
  const eu = e ? euDe(e) : null;
  return (
    <NavegacaoMesa
      nome={eu?.nome ?? "Demonstração"}
      escritorio={e?.escritorio.nome ?? "AdvFin"}
      foto={e?.perfil.foto}
      perfilHref={e ? "/app/perfil" : undefined}
      recentes={(e?.consultas ?? []).slice(0, 5).map((c) => ({ id: c.id, pergunta: c.pergunta }))}
      dev={false}
      extras={
        e
          ? [
              { href: "/app/casos", nome: "Casos", icone: "casos" },
              { href: "/app/escritorio", nome: "Escritório", icone: "escritorio" },
            ]
          : []
      }
      acao={
        <Link className="mesa-usuario-acao" href="/">
          Sair
        </Link>
      }
    />
  );
}
