"use client";

import Link from "next/link";
import { NavegacaoMesa } from "@/components/app/NavegacaoMesa";

/** Exemplos fixos: a demonstração não guarda nada, mas o menu precisa parecer o de um escritório em uso. */
const RECENTES = [
  { id: "1", pergunta: "Qual a alíquota da CBS e do IBS em 2026?" },
  { id: "2", pergunta: "Quando o ICMS e o ISS deixam de existir?" },
  { id: "3", pergunta: "Quais serviços têm redução de 60% nas alíquotas?" },
];

export function NavegacaoDemo() {
  return (
    <NavegacaoMesa
      nome="Visitante"
      escritorio="Escritório de demonstração"
      recentes={RECENTES}
      dev={false}
      acao={
        <Link className="mesa-usuario-acao" href="/">
          Sair
        </Link>
      }
    />
  );
}
