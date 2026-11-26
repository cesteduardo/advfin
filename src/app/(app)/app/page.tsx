import Link from "next/link";
import { Cabeca } from "@/components/app/Cabeca";
import { Icone } from "@/components/app/Icone";
import { exigirSessao } from "@/lib/auth/sessao";
import { noEscritorio } from "@/lib/db";
import { provedor } from "@/lib/llm/provedores";

export const metadata = { title: "Início — AdvFin" };

const ROTULO: Record<string, string> = {
  respondida: "Respondida",
  bloqueada_citacao: "Bloqueada pelo verificador",
  erro: "Erro",
  pendente: "Em andamento",
};

export default async function Inicio() {
  const s = await exigirSessao();
  const consultas = await noEscritorio(s, async (c) =>
    (
      await c.query(
        `select id, pergunta, status, data_referencia, criado_em, usuario_id from consultas order by criado_em desc limit 8`,
      )
    ).rows,
  );
  const semModelo = !provedor().redige;
  const primeiro = s.nome.split(" ")[0];

  return (
    <>
      <Cabeca trilha={`${s.escritorio} / Início`} titulo={`Olá, ${primeiro}. O que vamos conferir hoje?`} />

      {semModelo && (
        <p className="alerta aviso">
          Modo sem IA: a pesquisa devolve os dispositivos mais relevantes, literalmente, sem redação. A redação liga quando a
          chave do modelo for configurada.
        </p>
      )}

      <div className="atalhos">
        <Link className="atalho" href="/app/pesquisa">
          <span className="icone"><Icone nome="pesquisa" /></span>
          <h2>Pesquisa fundamentada</h2>
          <p>Pergunte em linguagem natural e receba a resposta com a fonte ao lado, no que valia na data escolhida.</p>
        </Link>
        <Link className="atalho" href="/app/calculo">
          <span className="icone"><Icone nome="calculo" /></span>
          <h2>Cálculo da transição</h2>
          <p>Linha do tempo 2026–2033, comparador de regimes e apuração com créditos, por motor determinístico.</p>
        </Link>
        <Link className="atalho" href="/app/classificacao">
          <span className="icone"><Icone nome="classificacao" /></span>
          <h2>Classificação NCM/NBS</h2>
          <p>Encontre o regime de IBS/CBS de um produto ou serviço, com o fundamento e o status de conferência.</p>
        </Link>
      </div>

      <section className="bloco" aria-labelledby="recentes">
        <p className="mesa-rotulo" id="recentes">{s.nivel === "supervisionado" ? "Suas consultas recentes" : "Consultas recentes que você pode ver"}</p>
        {consultas.length === 0 ? (
          <p className="mesa-vazio-cartao">Nenhuma consulta ainda. Comece pela pesquisa.</p>
        ) : (
          <ul className="mesa-lista">
            {consultas.map((c: any) => (
              <li key={c.id}>
                <Link href={`/app/consultas/${c.id}`}>{c.pergunta}</Link>
                <span>
                  {ROTULO[c.status] ?? c.status} · {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
