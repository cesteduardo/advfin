"use client";

import { useRouter } from "next/navigation";
import { acaoPesquisar } from "@/lib/pesquisa/acao";
import { PesquisaMesa } from "./PesquisaMesa";

/** Pesquisa do app: a resposta vem do servidor, e o menu de consultas recentes se atualiza. */
export function Pesquisa() {
  const router = useRouter();
  return <PesquisaMesa executar={acaoPesquisar} aoConcluir={() => router.refresh()} />;
}
