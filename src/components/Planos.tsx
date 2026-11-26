"use client";

import { useState } from "react";
import { Segmentado } from "./Segmentado";
import { formatarReais } from "@/lib/tax/money";

type Periodo = "mensal" | "anual";

const PLANOS: { nome: string; publico: string; centavos: number | null; unidade: string; itens: string[]; recomendado?: boolean }[] = [
  { nome: "Essencial", publico: "Advogado autônomo", centavos: 19_700, unidade: "/mês", itens: ["Pesquisa fundamentada", "Copiloto da Reforma", "Exportação para Word e PDF", "Limite mensal de consultas"] },
  { nome: "Escritório", publico: "3 a 20 usuários", centavos: 24_900, unidade: "/usuário/mês", itens: ["Tudo do Essencial", "Base privada do escritório", "Modelos e estilo próprios", "Colaboração e papéis"], recomendado: true },
  { nome: "Tributário Pro", publico: "Escritórios e jurídicos de empresa", centavos: 44_900, unidade: "/usuário/mês", itens: ["Tudo do Escritório", "Simulador avançado de créditos", "Análise de SPED", "Monitoramento por cliente"] },
  { nome: "Corporativo", publico: "Grandes bancas e empresas", centavos: null, unidade: "", itens: ["SSO e API", "Auditoria dedicada", "Contrato e SLA próprios"] },
];

/** Anual = 10 mensalidades (dois meses de desconto), exibido como equivalente mensal. */
const anualPorMes = (c: number) => Math.round((c * 10) / 12);
const semCentavos = (txt: string) => txt.replace(/,00$/, "");

export function Planos() {
  const [periodo, setPeriodo] = useState<Periodo>("mensal");
  return (
    <>
      <div className="planos-periodo">
        <Segmentado
          rotulo="Período de cobrança"
          valor={periodo}
          muda={setPeriodo}
          opcoes={[
            { id: "mensal", nome: "Mensal" },
            { id: "anual", nome: <>Anual <span className="selo-desconto">2 meses grátis</span></> },
          ]}
        />
      </div>
      <div className="planos">
        {PLANOS.map((p) => {
          const preco = p.centavos === null ? null : periodo === "mensal" ? p.centavos : anualPorMes(p.centavos);
          return (
            <article key={p.nome} className={`plano${p.recomendado ? " recomendado" : ""}`}>
              {p.recomendado && <p className="sobretitulo">Recomendado</p>}
              <h3>{p.nome}</h3>
              <p className="nota-pequena">{p.publico}</p>
              <p className="preco" aria-live="polite">
                {preco === null ? "Sob consulta" : semCentavos(formatarReais(preco))} <small>{p.unidade}</small>
              </p>
              <p className="preco-nota">
                {p.centavos === null
                  ? "Proposta sob medida"
                  : periodo === "anual"
                    ? `${semCentavos(formatarReais(p.centavos * 10))} por ano`
                    : "Cobrança mensal, sem fidelidade"}
              </p>
              <ul>
                {p.itens.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <a className={`botao${p.recomendado ? " ouro" : " secundario"}`} href="#lista">
                {p.centavos === null ? "Falar conosco" : "Entrar no beta"}
              </a>
            </article>
          );
        })}
      </div>
    </>
  );
}
