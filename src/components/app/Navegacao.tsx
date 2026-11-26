"use client";

import { sair } from "@/lib/auth/acoes";
import { NavegacaoMesa, type ConsultaRecente, type LinkExtra } from "./NavegacaoMesa";

export function Navegacao(props: {
  nome: string;
  escritorio: string;
  foto: string | null;
  recentes: ConsultaRecente[];
  dev: boolean;
  extras: LinkExtra[];
}) {
  return (
    <NavegacaoMesa
      {...props}
      perfilHref="/app/perfil"
      hrefConsulta={(id) => `/app/consultas/${id}`}
      acao={
        <form action={sair}>
          <button>Sair</button>
        </form>
      }
    />
  );
}
