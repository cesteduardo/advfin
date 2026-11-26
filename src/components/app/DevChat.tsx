"use client";

import { useState, useTransition } from "react";
import { acaoPesquisarDev } from "@/lib/pesquisa/acao";
import type { DesfechoPesquisa, Diagnostico } from "@/lib/pesquisa/orquestrador";
import { Icone } from "./Icone";

type Resultado = Awaited<ReturnType<typeof acaoPesquisarDev>>;
interface Rodada {
  pergunta: string;
  data: string;
  extrativo: boolean;
  r: Resultado | { erro: string };
}

const reais = (micro: number | null) => (micro === null ? "sem tabela de preço" : `R$ ${(micro / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`);
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

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
    ["Custo estimado", reais(d.custoMicroreais)],
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
  };
  const [classe, rotulo] = mapa[d.status];
  return <span className={`selo ${classe}`}>{rotulo}</span>;
}

function RodadaView({ rodada }: { rodada: Rodada }) {
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

export function DevChat({ provedor, redige }: { provedor: string; redige: boolean }) {
  const [pergunta, setPergunta] = useState("");
  const [data, setData] = useState(hoje);
  const [extrativo, setExtrativo] = useState(!redige);
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [pendente, iniciar] = useTransition();

  const enviar = () => {
    const q = pergunta.trim();
    if (q.length < 8) return;
    setPergunta("");
    iniciar(async () => {
      let r: Rodada["r"];
      try {
        r = await acaoPesquisarDev(q, data, extrativo);
      } catch (e) {
        r = { erro: (e as Error).message };
      }
      setRodadas((x) => [{ pergunta: q, data, extrativo, r }, ...x]);
    });
  };

  return (
    <div className="dev">
      <div className="mesa-auditoria">
        <p className="mesa-rotulo">Configuração do servidor</p>
        <ul>
          <li>
            <i className={redige ? "ok" : ""} />
            Provedor ativo: <b>{provedor}</b>
            <span>{redige ? "redige" : "sem chave: só extrativo"}</span>
          </li>
          <li>
            <i className="ok" />
            Cada teste passa pelo mesmo verificador e fica registrado em consultas e auditoria
          </li>
        </ul>
      </div>

      <form
        className="mesa-campo"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <label htmlFor="dev-pergunta" className="so-leitor">Pergunta de teste</label>
        <textarea
          id="dev-pergunta"
          rows={2}
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder="Pergunta de teste para o chat da IA…"
        />
        <div className="mesa-campo-pe">
          <div className="dev-opcoes">
            <label className="app-data">
              Vigência em
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label className="app-data dev-chave">
              <input type="checkbox" checked={extrativo} disabled={!redige} onChange={(e) => setExtrativo(e.target.checked)} />
              Forçar modo extrativo
            </label>
          </div>
          <button className="app-enviar" disabled={pendente || pergunta.trim().length < 8} aria-label="Enviar">
            <Icone nome="enviar" />
          </button>
        </div>
      </form>

      {pendente && <p className="mesa-carregando">Rodando recuperação, modelo e verificador…</p>}
      {rodadas.map((r, i) => (
        <RodadaView key={rodadas.length - i} rodada={r} />
      ))}
    </div>
  );
}
