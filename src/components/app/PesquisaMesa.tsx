"use client";

import Link from "next/link";
import { Fragment, useRef, useState, useTransition } from "react";
import type { DesfechoPesquisa } from "@/lib/pesquisa/tipos";
import type { Trecho } from "@/lib/pesquisa/tipos";
import { normalizar, normalizarComMapa } from "@/lib/pesquisa/verificador";
import { Icone } from "./Icone";
import { Simbolo } from "./Marca";

const SUGESTOES = [
  "Qual a alíquota da CBS e do IBS em 2026?",
  "Quando o ICMS e o ISS deixam de existir?",
  "Quais serviços têm redução de 60% nas alíquotas?",
  "O que acontece com PIS e Cofins a partir de 2027?",
];

export type Desfecho = DesfechoPesquisa | { status: "invalida"; mensagem: string };

const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

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

function vigente(t: Trecho, data: string) {
  return t.vigenciaInicio <= data && (!t.vigenciaFim || t.vigenciaFim > data);
}

/** Cartão de fonte, igual ao da demonstração: número e dispositivo, selo de vigência, norma e trecho. */
function CartaoFonte({ t, data, citados, ativa, aoClicar }: { t: Trecho; data: string; citados: string[]; ativa: boolean; aoClicar: () => void }) {
  return (
    <section id={`fonte-${t.ref}`} className="cartao-fonte" data-ativa={ativa ? "" : undefined} onClick={aoClicar}>
      <div className="cartao-fonte-topo">
        <strong>
          {t.ref.slice(1)} · {t.rotulo}
        </strong>
        {vigente(t, data) && <span className="selo vigente">Vigente em {dataBR(data)}</span>}
      </div>
      <span className="cartao-fonte-sub">
        {t.norma} ·{" "}
        <a href={t.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          texto oficial
        </a>
      </span>
      <blockquote>
        <Destaque texto={t.texto} trechos={citados} />
      </blockquote>
      {t.origem === "semente" ? (
        <span className="selo semente">Texto provisório, não conferido pelo curador</span>
      ) : t.curadoria === "publicado" ? (
        <span className="selo publicado">Conferido pelo curador</span>
      ) : (
        <span className="selo em_revisao">Aguardando o curador</span>
      )}
    </section>
  );
}

/** Régua de vigência do dispositivo em foco, de 2023 a 2033, com a data de referência marcada. */
function Regua({ t, data }: { t: Trecho; data: string }) {
  const ini = Date.UTC(2023, 0, 1);
  const fim = Date.UTC(2034, 0, 1);
  const pos = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(iso) - ini) / (fim - ini)) * 100));
  const a = pos(t.vigenciaInicio);
  const b = t.vigenciaFim ? pos(t.vigenciaFim) : 100;
  return (
    <div className="mesa-vigencia">
      <p className="mesa-rotulo">Vigência do dispositivo {t.ref.slice(1)}</p>
      <div className="regua" role="img" aria-label={`Vigente desde ${dataBR(t.vigenciaInicio)}${t.vigenciaFim ? ` até ${dataBR(t.vigenciaFim)}` : ", sem data final"}; consulta em ${dataBR(data)}`}>
        <b style={{ left: `${a}%`, width: `${b - a}%` }} />
        <i style={{ left: `${pos(data)}%` }} />
      </div>
      <div className="regua-anos">
        <span>2023</span>
        <span>{dataBR(data)}</span>
        <span>2033</span>
      </div>
      <p className="mesa-nota">
        Desde {dataBR(t.vigenciaInicio)}
        {t.vigenciaFim ? ` até ${dataBR(t.vigenciaFim)}` : ", sem revogação registrada"}.
      </p>
    </div>
  );
}

/**
 * A mesa da pesquisa, sem saber de onde vem a resposta: no app, de uma ação do servidor;
 * na demonstração estática, do laboratório que roda no navegador.
 */
export function PesquisaMesa({
  executar,
  aoConcluir,
  falhaRede = "Não foi possível falar com o servidor.",
}: {
  executar: (pergunta: string, data: string) => Promise<Desfecho>;
  aoConcluir?: () => void;
  falhaRede?: string;
}) {
  const [pergunta, setPergunta] = useState("");
  const [enviada, setEnviada] = useState<{ texto: string; data: string; hora: string } | null>(null);
  const [data, setData] = useState(hoje);
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const campo = useRef<HTMLTextAreaElement>(null);

  const enviar = (q = pergunta) => {
    if (q.trim().length < 8) return;
    setEnviada({ texto: q.trim(), data, hora: hora() });
    setPergunta("");
    setAtiva(null);
    iniciar(async () => {
      try {
        setDesfecho(await executar(q, data));
        aoConcluir?.();
      } catch {
        setDesfecho({ status: "erro", id: "", mensagem: falhaRede, fontes: [] });
      }
    });
  };

  const focar = (ref: string) => {
    setAtiva(ref);
    document.getElementById(`fonte-${ref}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const dataRef = enviada?.data ?? data;
  const fontes = desfecho && "fontes" in desfecho ? desfecho.fontes : [];
  const citados = new Map<string, string[]>();
  if (desfecho?.status === "respondida") {
    for (const c of desfecho.citacoes) citados.set(c.ref, [...(citados.get(c.ref) ?? []), c.trecho]);
  }
  const exibidas = desfecho?.status === "respondida" ? fontes.filter((f) => citados.has(f.ref)) : fontes;
  const foco = exibidas.find((f) => f.ref === ativa) ?? exibidas[0];
  const provisorio = exibidas.some((f) => f.origem === "semente" || f.curadoria !== "publicado");

  return (
    <div className="mesa-grade">
      <section className="mesa-conversa" aria-live="polite">
        {!enviada && (
          <div className="mesa-resposta mesa-boas-vindas">
            <p className="mesa-autor">
              <Simbolo /> AdvFin · pesquisa fundamentada
            </p>
            <p>
              Pergunte em linguagem natural. A resposta usa só dispositivos vigentes na data escolhida, com o trecho ao lado. Se
              alguma citação não existir na base, a resposta é bloqueada.
            </p>
            <div className="mesa-acoes">
              {SUGESTOES.map((s) => (
                <button type="button" key={s} onClick={() => enviar(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {enviada && <p className="mesa-pergunta">{enviada.texto}</p>}

        {pendente && (
          <div className="mesa-resposta">
            <p className="mesa-autor">
              <Simbolo /> AdvFin · conferindo citações
            </p>
            <p className="mesa-carregando">Buscando dispositivos vigentes em {dataBR(dataRef)}…</p>
          </div>
        )}

        {!pendente && desfecho?.status === "respondida" && (
          <>
            <article className="mesa-resposta">
              <p className="mesa-autor">
                <Simbolo /> AdvFin · {desfecho.redigida ? "revisão pendente" : "trechos literais, sem redação"}
              </p>
              {provisorio && (
                <p className="alerta aviso">Fontes ainda não conferidas pelo tributarista curador. Use como ponto de partida, não em peça.</p>
              )}
              {desfecho.paragrafos.map((p, i) => (
                <p key={i}>
                  {p.split(/(\[D\d{1,2}\])/).map((parte, j) => {
                    const m = /^\[(D\d{1,2})\]$/.exec(parte);
                    return m ? (
                      <sup key={j} className="cit">
                        <button type="button" aria-pressed={ativa === m[1]} onClick={() => focar(m[1])} aria-label={`Ver fonte ${m[1].slice(1)}`}>
                          {m[1].slice(1)}
                        </button>
                      </sup>
                    ) : (
                      <Fragment key={j}>{parte}</Fragment>
                    );
                  })}
                </p>
              ))}
              <div className="mesa-acoes">
                <button type="button" className="primaria" onClick={() => window.print()}>
                  Imprimir ou salvar PDF
                </button>
                <Link href="/app/calculo">Simular a transição</Link>
                <button type="button" onClick={() => campo.current?.focus()}>
                  Nova pergunta
                </button>
              </div>
            </article>
            <div className="mesa-auditoria">
              <p className="mesa-rotulo">Trilha de auditoria</p>
              <ul>
                <li>
                  <i className="ok" />
                  {desfecho.citacoes.length === 1 ? "Citação conferida" : `${desfecho.citacoes.length} citações conferidas`} na base versionada
                  <span>{enviada?.hora}</span>
                </li>
                <li>
                  <i className="ok" />
                  Vigência confirmada em {dataBR(dataRef)}
                  <span>{enviada?.hora}</span>
                </li>
                <li>
                  <i />
                  Aguardando revisão do advogado<span>agora</span>
                </li>
              </ul>
            </div>
          </>
        )}

        {!pendente && desfecho?.status === "bloqueada_citacao" && (
          <>
            <article className="mesa-resposta">
              <p className="mesa-autor">
                <Simbolo /> AdvFin · resposta bloqueada
              </p>
              <p>A resposta não foi exibida porque não se sustenta inteiramente na base. Reformule a pergunta ou leia os dispositivos ao lado.</p>
            </article>
            <div className="mesa-auditoria">
              <p className="mesa-rotulo">Trilha de auditoria</p>
              <ul>
                {desfecho.motivos.map((m, i) => (
                  <li key={i}>
                    <i className="falha" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {!pendente && desfecho?.status === "sem_resultado" && (
          <div className="mesa-resposta">
            <p className="mesa-autor">
              <Simbolo /> AdvFin · sem dispositivos
            </p>
            <p>
              Nenhum dispositivo vigente em {dataBR(dataRef)} trata disso na base atual, que ainda cobre só o núcleo da Reforma (EC
              132/2023 e LC 214/2025).
            </p>
          </div>
        )}

        {!pendente && (desfecho?.status === "erro" || desfecho?.status === "invalida") && (
          <p className="alerta erro" role="alert">
            {desfecho.mensagem}
          </p>
        )}

        <form
          className="mesa-campo"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <label htmlFor="pergunta" className="so-leitor">
            Pergunta
          </label>
          <textarea
            id="pergunta"
            ref={campo}
            rows={2}
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Pergunte sobre a transição…"
            maxLength={2000}
          />
          <div className="mesa-campo-pe">
            <label className="app-data">
              Vigência em
              <input type="date" value={data} min="2023-12-21" onChange={(e) => setData(e.target.value)} required />
            </label>
            <button className="app-enviar" disabled={pendente || pergunta.trim().length < 8} aria-label="Pesquisar">
              <Icone nome="enviar" />
            </button>
          </div>
        </form>
      </section>

      <aside className="mesa-fontes" aria-label="Fontes">
        <p className="mesa-rotulo">{desfecho?.status === "respondida" ? "Fontes conferidas" : "Dispositivos encontrados"}</p>
        {exibidas.length === 0 && <p className="mesa-vazio-cartao">As fontes aparecem aqui, com o trecho original e a vigência.</p>}
        {exibidas.map((f) => (
          <CartaoFonte key={f.id} t={f} data={dataRef} citados={citados.get(f.ref) ?? []} ativa={foco?.ref === f.ref && exibidas.length > 1} aoClicar={() => setAtiva(f.ref)} />
        ))}
        {foco && <Regua t={foco} data={dataRef} />}
      </aside>
    </div>
  );
}
