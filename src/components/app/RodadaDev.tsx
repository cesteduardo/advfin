"use client";

import type { DesfechoPesquisa, Diagnostico } from "@/lib/pesquisa/tipos";

/** Uma rodada de teste do chat: usada pelo laboratório do app (/app/dev) e pelo estático (/lab). */
export interface Rodada {
  pergunta: string;
  data: string;
  r: { desfecho: DesfechoPesquisa | { status: "invalida"; mensagem: string }; diagnostico: Diagnostico | null } | { erro: string };
}

const reais = (micro: number | null) => (micro === null ? "sem tabela de preço" : `R$ ${(micro / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`);
export const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const dolares = (usd: number) => usd === 0 ? "sem custo (sem modelo)" : `US$ ${usd.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;

function Metricas({ d }: { d: Diagnostico }) {
  const itens: [string, string][] = [
    ["Provedor", d.provedor],
    ["Modelo", d.modelo],
    ["Recuperação", `${d.ms.recuperacao} ms`],
    ["Modelo (até a resposta completa)", `${d.ms.modelo} ms`],
    ["Verificador", `${d.ms.verificacao} ms`],
    ["Total", `${d.ms.total} ms`],
    ["Tokens de entrada", d.tokens.entrada?.toLocaleString("pt-BR") ?? "—"],
    ["Tokens de saída", d.tokens.saida?.toLocaleString("pt-BR") ?? "—"],
    ["Custo estimado", d.custoUsd != null ? dolares(d.custoUsd) : reais(d.custoMicroreais)],
  ];
  return (
    <dl className="dev-metricas">
      {itens.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Status({ d }: { d: DesfechoPesquisa | { status: "invalida"; mensagem: string } }) {
  const mapa: Record<string, [string, string]> = {
    respondida: ["vigente", "Aprovada pelo verificador"],
    bloqueada_citacao: ["bloqueada", "Bloqueada pelo verificador"],
    sem_resultado: ["premissa", "Sem dispositivos recuperados"],
    erro: ["bloqueada", "Erro"],
    invalida: ["premissa", "Pergunta inválida"],
    conversa: ["premissa", "Conversa sem fonte verificada"],
  };
  const [classe, rotulo] = mapa[d.status];
  return <span className={`selo ${classe}`}>{rotulo}</span>;
}

export function RodadaView({ rodada }: { rodada: Rodada }) {
  if ("erro" in rodada.r) return <p className="alerta erro">{rodada.r.erro}</p>;
  const { desfecho: d, diagnostico: g } = rodada.r;
  return (
    <article className="mesa-resposta dev-rodada">
      <div className="dev-rodada-topo">
        <p className="mesa-pergunta">{rodada.pergunta}</p>
        <Status d={d} />
      </div>
      {g && <Metricas d={g} />}

      {d.status === "respondida" && (
        <div className="dev-bloco">
          <p className="mesa-rotulo">Resposta exibida ao advogado</p>
          {d.paragrafos.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className="mesa-rotulo">Citações aprovadas</p>
          <ul className="dev-lista">
            {d.citacoes.map((c, i) => (
              <li key={i}>
                <b>{c.ref}</b> {c.dispositivo.norma}, {c.dispositivo.rotulo}: “{c.trecho}”
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.status === "bloqueada_citacao" && (
        <div className="dev-bloco">
          <p className="mesa-rotulo">Motivos do bloqueio</p>
          <ul className="dev-lista falha">
            {d.motivos.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {(d.status === "erro" || d.status === "invalida") && <p className="alerta erro">{d.mensagem}</p>}
      {d.status === "conversa" && d.paragrafos.map((x, i) => <p key={i}>{x}</p>)}
      {g?.erro && <p className="alerta erro">Erro técnico: {g.erro}</p>}

      {"fontes" in d && d.fontes.length > 0 && (
        <details className="dev-detalhe">
          <summary>Dispositivos recuperados ({d.fontes.length})</summary>
          <ul className="dev-lista">
            {d.fontes.map((f) => (
              <li key={f.id}>
                <b>{f.ref}</b> {f.norma}, {f.rotulo} · {f.curadoria} · {f.origem}
              </li>
            ))}
          </ul>
        </details>
      )}
      {g?.saidaBruta && (
        <details className="dev-detalhe">
          <summary>Saída bruta do modelo</summary>
          <pre>{g.saidaBruta}</pre>
        </details>
      )}
      {g?.respostaLida != null && (
        <details className="dev-detalhe">
          <summary>JSON lido pelo verificador</summary>
          <pre>{JSON.stringify(g.respostaLida, null, 2)}</pre>
        </details>
      )}
      {g?.mensagem && (
        <details className="dev-detalhe">
          <summary>Prompt enviado (sistema + mensagem)</summary>
          <pre>{`${g.sistema}\n\n────────\n\n${g.mensagem}`}</pre>
        </details>
      )}
    </article>
  );
}

