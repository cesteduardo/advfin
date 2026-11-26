"use client";

import { sair } from "@/lib/auth/acoes";
import { NavegacaoMesa, type ConsultaRecente } from "./NavegacaoMesa";

export function Navegacao(props: { nome: string; escritorio: string; recentes: ConsultaRecente[]; dev: boolean }) {
  return (
    <NavegacaoMesa
      {...props}
      acao={
        <form action={sair}>
          <button>Sair</button>
        </form>
      }
    />
  );
}
