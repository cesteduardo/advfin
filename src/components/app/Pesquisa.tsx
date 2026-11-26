"use client";

import { Fragment, useState, useTransition } from "react";
import { acaoPesquisar } from "@/lib/pesquisa/acao";
import type { DesfechoPesquisa } from "@/lib/pesquisa/orquestrador";
import type { Trecho } from "@/lib/pesquisa/tipos";
import { normalizar, normalizarComMapa } from "@/lib/pesquisa/verificador";

const SUGESTOES = [
  "Qual a alíquota da CBS e do IBS em 2026?",
  "Quando o ICMS e o ISS deixam de existir?",
  "Quais serviços têm redução de 60% nas alíquotas?",
  "O que acontece com PIS e Cofins a partir de 2027?",
];

type Desfecho = DesfechoPesquisa | { status: "invalida"; mensagem: string };

const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Destaca no texto do dispositivo o trecho citado (comparação normalizada, posição no original). */
function Destaque({ texto, trechos }: { texto: string; trechos: string[] }) {
  const { norm, mapa } = normalizarComMapa(texto);
  const faixas: [number, number][] = [];
  for (const t of trechos) {
    const alvo = normalizar(t.replace(/^["'“]|["'”]$/g, ""));
    const p = norm.indexOf(alvo);
    if (p >= 0 && alvo) faixas.push([mapa[p], mapa[p + alvo.length - 1] + 1]);
  }
  if (!faixas.length) return <>{texto}</>;
  faixas.sort((a, b) => a[0] - b[0]);
  const partes: React.ReactNode[] = [];
  let pos = 0;
  faixas.forEach(([a, b], i) => {
    if (a < pos) return;
    partes.push(texto.slice(pos, a), <mark key={i}>{texto.slice(a, b)}</mark>);
    pos = b;
  });
  partes.push(texto.slice(pos));
  return <>{partes}</>;
}

function SeloCuradoria({ t }: { t: Trecho }) {
  if (t.origem === "semente") return <span className="selo semente">Texto provisório, não conferido</span>;
  if (t.curadoria === "publicado") return <span className="selo publicado">Conferido pelo curador</span>;
  return <span className="selo em_revisao">Aguardando curador</span>;
}

export function Pesquisa() {
  const [pergunta, setPergunta] = useState("");
  const [data, setData] = useState(hoje);
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const enviar = (q = pergunta) => {
    if (!q.trim()) return;
    setPergunta(q);
    setAtiva(null);
    iniciar(async () => {
      try {
        setDesfecho(await acaoPesquisar(q, data));
      } catch {
        setDesfecho({ status: "erro", id: "", mensagem: "Não foi possível falar com o servidor.", fontes: [] });
      }
    });
  };

  const focar = (ref: string) => {
    setAtiva(ref);
    document.getElementById(`fonte-${ref}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const fontes = desfecho && "fontes" in desfecho ? desfecho.fontes : [];
  const citadosPorRef = new Map<string, string[]>();
  if (desfecho?.status === "respondida") {
    for (const c of desfecho.citacoes) citadosPorRef.set(c.ref, [...(citadosPorRef.get(c.ref) ?? []), c.trecho]);
  }
  const fontesExibidas = desfecho?.status === "respondida" ? fontes.filter((f) => citadosPorRef.has(f.ref)) : fontes;
  const temProvisorio = fontesExibidas.some((f) => f.origem === "semente" || f.curadoria !== "publicado");

  return (
    <div className="pesquisa">
      <div>
        <form
          className="pergunta-form"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <label htmlFor="pergunta" className="so-leitor">Pergunta</label>
          <textarea
            id="pergunta"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enviar();
            }}
            placeholder="Ex.: Qual a alíquota da CBS em 2026 e como ela se compensa com o PIS/Cofins?"
            maxLength={2000}
          />
          <div className="pergunta-linha">
            <label className="data-ref">
              O que valia em
              <input type="date" value={data} min="2023-12-21" onChange={(e) => setData(e.target.value)} required />
            </label>
            <button className="botao peq" disabled={pendente || pergunta.trim().length < 8}>
              {pendente ? "Pesquisando…" : "Pesquisar"}
            </button>
          </div>
          {!desfecho && (
            <div className="sugestoes" aria-label="Sugestões">
              {SUGESTOES.map((s) => (
                <button type="button" key={s} onClick={() => enviar(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>

        <div aria-live="polite">
          {pendente && <p className="resposta nota-pequena">Buscando dispositivos vigentes em {dataBR(data)} e conferindo citações…</p>}

          {!pendente && desfecho?.status === "respondida" && (
            <article className="resposta">
              <div className="resposta-cabeca">
                <h2>{desfecho.redigida ? "Resposta" : "Dispositivos mais relevantes"}</h2>
                <span className="selo vigente">Citações conferidas na base · {dataBR(data)}</span>
              </div>
              {temProvisorio && (
                <p className="alerta aviso">
                  Há fontes ainda não conferidas pelo tributarista curador. Use como ponto de partida, não em peça.
                </p>
              )}
              <div className="resposta-texto">
                {desfecho.paragrafos.map((p, i) => (
                  <p key={i}>
                    {p.split(/(\[D\d{1,2}\])/).map((parte, j) => {
                      const m = /^\[(D\d{1,2})\]$/.exec(parte);
                      return m ? (
                        <button key={j} type="button" className="marca-fonte" aria-pressed={ativa === m[1]} onClick={() => focar(m[1])} aria-label={`Ver fonte ${m[1]}`}>
                          {m[1].slice(1)}
                        </button>
                      ) : (
                        <Fragment key={j}>{parte}</Fragment>
                      );
                    })}
                  </p>
                ))}
              </div>
              <div className="resposta-pe">
                <span>
                  {desfecho.redigida ? `Redigido por IA (${desfecho.modelo}) e conferido pelo verificador.` : "Sem redação por IA: trechos literais da base."} A
                  decisão é do advogado.
                </span>
                <button type="button" onClick={() => window.print()}>Imprimir ou salvar em PDF</button>
              </div>
            </article>
          )}

          {!pendente && desfecho?.status === "bloqueada_citacao" && (
            <article className="resposta">
              <div className="resposta-cabeca">
                <h2>Resposta bloqueada</h2>
                <span className="selo bloqueada">Verificador de citações</span>
              </div>
              <p>
                A resposta não foi exibida porque não se sustenta inteiramente na base. Reformule a pergunta ou consulte os
                dispositivos ao lado.
              </p>
              <ul className="motivos">
                {desfecho.motivos.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </article>
          )}

          {!pendente && desfecho?.status === "sem_resultado" && (
            <p className="resposta">
              Nenhum dispositivo vigente em {dataBR(data)} trata disso na base atual. A base ainda cobre só o núcleo da Reforma
              (EC 132/2023 e LC 214/2025).
            </p>
          )}

          {!pendente && (desfecho?.status === "erro" || desfecho?.status === "invalida") && (
            <p className="resposta alerta erro" role="alert">{desfecho.mensagem}</p>
          )}
        </div>
      </div>

      <aside className="fontes" aria-label="Fontes">
        <div className="fontes-cabeca">
          <span>Fontes {fontesExibidas.length ? `(${fontesExibidas.length})` : ""}</span>
        </div>
        {fontesExibidas.length === 0 && <p className="vazio">As fontes aparecem aqui, com o trecho original e a vigência.</p>}
        {fontesExibidas.map((f) => (
          <section key={f.id} id={`fonte-${f.ref}`} className="fonte" data-ativa={ativa === f.ref ? "" : undefined}>
            <div className="fonte-topo">
              <strong>
                <span className="fonte-ref">{f.ref.slice(1)}</span> {f.norma}, {f.rotulo}
              </strong>
              <SeloCuradoria t={f} />
            </div>
            <blockquote>
              <Destaque texto={f.texto} trechos={citadosPorRef.get(f.ref) ?? []} />
            </blockquote>
            <div className="fonte-meta">
              <span>
                Vigente desde {dataBR(f.vigenciaInicio)}
                {f.vigenciaFim ? ` até ${dataBR(f.vigenciaFim)}` : ""}
              </span>
              <a href={f.url} target="_blank" rel="noopener noreferrer">
                Texto oficial
              </a>
            </div>
          </section>
        ))}
      </aside>
    </div>
  );
}
