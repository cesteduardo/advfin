import Link from "next/link";
import { Cabeca } from "@/components/app/Cabeca";
import { Icone } from "@/components/app/Icone";

export const metadata = { title: "Início — demonstração AdvFin" };

const EXEMPLOS = [
  { pergunta: "Qual a alíquota da CBS e do IBS em 2026?", status: "Respondida", quando: "hoje" },
  { pergunta: "Quando o ICMS e o ISS deixam de existir?", status: "Respondida", quando: "hoje" },
  { pergunta: "Quais serviços têm redução de 60% nas alíquotas?", status: "Respondida", quando: "ontem" },
];

export default function InicioDemo() {
  return (
    <>
      <Cabeca trilha="Escritório de demonstração / Início" titulo="Olá. O que vamos conferir hoje?" />

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
        <p className="mesa-rotulo" id="recentes">Consultas recentes do escritório (exemplo)</p>
        <ul className="mesa-lista">
          {EXEMPLOS.map((c) => (
            <li key={c.pergunta}>
              <span>{c.pergunta}</span>
              <span>
                {c.status} · {c.quando}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
