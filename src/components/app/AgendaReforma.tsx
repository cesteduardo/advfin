"use client";

import { useEffect, useState } from "react";

/**
 * Marcos da transição (EC 132/2023, art. 125 a 133 do ADCT; LC 214/2025), em ordem.
 * Texto curto, para o Início; o fundamento completo fica na pesquisa.
 */
export const MARCOS = [
  { data: "2026-01-01", titulo: "Ano de teste", texto: "CBS a 0,9% e IBS a 0,1%, destacados na nota e compensáveis com PIS/Cofins." },
  { data: "2027-01-01", titulo: "CBS plena", texto: "PIS e Cofins deixam de existir; começa o Imposto Seletivo; IPI zerado, salvo na Zona Franca." },
  { data: "2029-01-01", titulo: "Começa a troca do ICMS e do ISS", texto: "As alíquotas recuam a 90% em 2029 e chegam a 60% em 2032, enquanto o IBS ocupa o espaço." },
  { data: "2033-01-01", titulo: "Fim do ICMS e do ISS", texto: "IBS e CBS passam a ser os únicos tributos sobre o consumo, além do Imposto Seletivo." },
] as const;

const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const hojeISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const dias = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);

/** Agenda da Reforma com o próximo marco em destaque e a contagem de dias até ele. */
export function AgendaReforma() {
  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => setHoje(hojeISO()), []);
  const proximo = hoje ? MARCOS.find((m) => m.data > hoje) : null;
  return (
    <section className="mesa-cartao inicio-agenda" aria-labelledby="agenda-titulo">
      <div className="inicio-cartao-topo">
        <h2 id="agenda-titulo">Agenda da Reforma</h2>
        {proximo && hoje && (
          <span className="selo vigente">
            Próximo marco em {dias(hoje, proximo.data)} dias
          </span>
        )}
      </div>
      <ol className="inicio-marcos">
        {MARCOS.map((m) => {
          const estado = !hoje ? "futuro" : m === proximo ? "proximo" : m.data <= hoje ? "passado" : "futuro";
          return (
            <li key={m.data} data-estado={estado}>
              <span className="inicio-marco-ponto" aria-hidden="true" />
              <div>
                <p className="inicio-marco-data">{dataBR(m.data)}{estado === "passado" ? " · em vigor" : estado === "proximo" ? " · próximo" : ""}</p>
                <strong>{m.titulo}</strong>
                <p>{m.texto}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
