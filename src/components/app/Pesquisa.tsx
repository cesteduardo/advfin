"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { acaoPesquisar, acaoRelatarCitacao } from "@/lib/pesquisa/acao";
import { acaoTranscrever } from "@/lib/anexos/acao-voz";
import { PesquisaMesa } from "./PesquisaMesa";

/** Pesquisa do app: a resposta vem do servidor, e o menu de consultas recentes se atualiza. */
export function Pesquisa({ nome, dataInicial, casos, casoInicial, voz, perguntaInicial }: { nome?: string; dataInicial: string; casos: { id: string; titulo: string }[]; casoInicial?: string; voz?: boolean; perguntaInicial?: string }) {
  const router = useRouter();
  return (
    <PesquisaMesa
      executar={acaoPesquisar}
      aoConcluir={() => router.refresh()}
      nome={nome}
      dataInicial={dataInicial}
      casos={casos}
      casoInicial={casoInicial}
      perguntaInicial={perguntaInicial}
      transcrever={
        voz
          ? async (audio) => {
              const f = new FormData();
              f.append("audio", audio);
              const r = await acaoTranscrever(f);
              if ("erro" in r) throw new Error(r.erro);
              return r.texto;
            }
          : undefined
      }
      relatar={(consulta, r) => acaoRelatarCitacao({ consulta: consulta || null, ...r })}
      exportar={(id) => (
        <Link className="primaria" href={`/app/consultas/${id}`}>
          Abrir como parecer
        </Link>
      )}
    />
  );
}
