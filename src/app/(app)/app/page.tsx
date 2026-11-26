import Link from "next/link";
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
        `select id, pergunta, status, data_referencia, criado_em from consultas order by criado_em desc limit 8`,
      )
    ).rows,
  );
  const semModelo = !provedor().redige;
  const primeiro = s.nome.split(" ")[0];

  return (
    <>
      <div className="palco-cabeca">
        <div>
          <h1>
            Olá, {primeiro}. <em>O que vamos conferir hoje?</em>
          </h1>
          <p>Toda resposta traz o trecho da norma e a data de vigência. O que não se apoia na base é bloqueado.</p>
        </div>
      </div>

      {semModelo && (
        <p className="alerta aviso">
          Modo sem IA: a pesquisa devolve os dispositivos mais relevantes, literalmente, sem redação. A redação liga quando a
          chave do modelo for configurada.
        </p>
      )}

      <div className="atalhos">
        <Link className="atalho" href="/app/pesquisa">
          <span className="icone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></svg></span>
          <h2>Pesquisa fundamentada</h2>
          <p>Pergunte em linguagem natural e receba a resposta com a fonte ao lado, no que valia na data escolhida.</p>
        </Link>
        <Link className="atalho" href="/app/calculo">
          <span className="icone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.5 7.5h7" /></svg></span>
          <h2>Cálculo da transição</h2>
          <p>Linha do tempo 2026–2033, comparador de regimes e apuração com créditos, por motor determinístico.</p>
        </Link>
        <Link className="atalho" href="/app/classificacao">
          <span className="icone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h6" /></svg></span>
          <h2>Classificação NCM/NBS</h2>
          <p>Encontre o regime de IBS/CBS de um produto ou serviço, com o fundamento e o status de conferência.</p>
        </Link>
      </div>

      <section className="bloco" aria-labelledby="recentes">
        <h2 id="recentes">Consultas recentes do escritório</h2>
        {consultas.length === 0 ? (
          <p className="vazio">Nenhuma consulta ainda. Comece pela pesquisa.</p>
        ) : (
          <ul className="lista-simples">
            {consultas.map((c: any) => (
              <li key={c.id}>
                <span>{c.pergunta}</span>
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
