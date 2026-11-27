"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { acaoPesquisar } from "@/lib/pesquisa/acao";
import { PesquisaMesa } from "./PesquisaMesa";

/** Pesquisa do app: a resposta vem do servidor, e o menu de consultas recentes se atualiza. */
export function Pesquisa({ nome, dataInicial, casos, casoInicial }: { nome?: string; dataInicial: string; casos: { id: string; titulo: string }[]; casoInicial?: string }) {
  const router = useRouter();
  return (
    <PesquisaMesa
      executar={acaoPesquisar}
      aoConcluir={() => router.refresh()}
      nome={nome}
      dataInicial={dataInicial}
      casos={casos}
      casoInicial={casoInicial}
      exportar={(id) => (
        <Link className="primaria" href={`/app/consultas/${id}`}>
          Abrir como parecer
        </Link>
      )}
    />
  );
}
