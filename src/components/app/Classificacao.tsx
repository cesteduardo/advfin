"use client";

import { useState } from "react";
import { REGIMES } from "@/lib/tax/cronograma";
import { CLASSIFICACOES, classificar } from "@/lib/tax/classificacao";

const formatarCodigo = (tipo: string, c: string) =>
  !c ? "Código NBS a definir pelo curador" : tipo === "NCM" ? `NCM ${c.replace(/^(\d{4})(\d{2})?(\d{2})?$/, (_, a, b, d) => [a, b, d].filter(Boolean).join("."))}` : `NBS ${c}`;

export function Classificacao() {
  const [q, setQ] = useState("");
  const resultados = q.trim().length >= 3 ? classificar(q) : [];

  return (
    <>
      <form className="pergunta-form" onSubmit={(e) => e.preventDefault()} role="search">
        <label htmlFor="q" className="so-leitor">Código NCM/NBS ou descrição</label>
        <input
          id="q"
          className="campo-busca"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ex.: 1006.30.21, feijão, serviços de advocacia"
          style={{ minHeight: 52, padding: "12px 16px", border: 0, borderRadius: 16, background: "var(--superficie)", fontSize: 16 }}
          autoComplete="off"
        />
        <p className="nota-pequena">
          Tabela em formação: {CLASSIFICACOES.length} enquadramentos de partida, todos aguardando conferência do curador. Nada aqui
          é escolhido por IA.
        </p>
      </form>

      <div className="resultados-class" aria-live="polite">
        {q.trim().length >= 3 && resultados.length === 0 && (
          <p className="vazio">
            Nenhum enquadramento na tabela para “{q}”. Sem correspondência, a regra geral é a alíquota padrão, mas confira se o
            item está em algum anexo da LC 214/2025.
          </p>
        )}
        {resultados.map(({ item, criterio }) => (
          <article key={item.descricao} className="class-item">
            <div>
              <h3>{item.descricao}</h3>
              <span className="codigo">
                {formatarCodigo(item.tipo, item.codigo)} · {criterio === "codigo" ? "por código" : "por descrição"}
              </span>
            </div>
            <span className="regime">{REGIMES[item.regime].rotulo}</span>
            <p>
              <span className="selo em_revisao">a conferir</span> {item.fundamento}
              {item.observacao ? ` ${item.observacao}` : ""}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
