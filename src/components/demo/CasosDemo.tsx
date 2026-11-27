"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";
import { Cabeca } from "@/components/app/Cabeca";
import { Avatar } from "@/components/app/NavegacaoMesa";
import { Seletor } from "@/components/ui/Seletor";
import { ROTULO_NIVEL, acimaOuIgual } from "@/lib/auth/niveis";
import { alterar, agora, euDe, nomeDe, novoId, useDemo } from "./estado";
import { useAviso } from "./PerfilDemo";

const dia = (s: string) => new Date(s).toLocaleDateString("pt-BR");
const ordem = (i: number) => ({ "--i": i }) as CSSProperties;

/** Casos da demonstração: criar, abrir, incluir colegas e ver as consultas feitas no caso. */
export function CasosDemo() {
  const e = useDemo();
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, avisar] = useAviso();
  if (!e) return null;
  const eu = euDe(e);
  const caso = e.casos.find((c) => c.id === aberto);

  const criar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const titulo = String(f.get("titulo") ?? "").trim();
    if (titulo.length < 3) return avisar("Dê um título ao caso.");
    const id = novoId();
    alterar((x) => ({ ...x, casos: [{ id, titulo, cliente: String(f.get("cliente") ?? "").trim(), autor: x.eu, criadoEm: agora(), incluidos: [] }, ...x.casos] }), "caso_criado", titulo);
    ev.currentTarget.reset();
    setAberto(id);
  };

  if (caso) {
    const consultas = e.consultas.filter((c) => c.caso === caso.id);
    const candidatos = e.pessoas.filter((p) => p.situacao === "ativo" && p.id !== caso.autor && !caso.incluidos.includes(p.id) && !acimaOuIgual(p.nivel, "membro"));
    return (
      <>
        <Cabeca trilha={`${e.escritorio.nome} / Casos / ${caso.titulo}`} titulo={caso.titulo} descricao={`${caso.cliente ? `${caso.cliente} · ` : ""}criado por ${caso.autor === eu.id ? "você" : nomeDe(e, caso.autor)} em ${dia(caso.criadoEm)} · visível para Membros para cima e para quem for incluído`}>
          <div className="mesa-acoes">
            <button type="button" onClick={() => setAberto(null)}>← Todos os casos</button>
            <Link className="primaria" href={`/app/pesquisa?caso=${caso.id}`}>Pesquisar neste caso</Link>
          </div>
        </Cabeca>
        {aviso && <p className="alerta info mesa-entra" role="status">{aviso}</p>}
        <div className="mesa-grade-2" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)" }}>
          <section className="bloco mesa-entra">
            <p className="mesa-rotulo">Consultas do caso</p>
            {consultas.length === 0 ? (
              <p className="mesa-vazio-cartao">Nenhuma consulta neste caso ainda.</p>
            ) : (
              <ul className="mesa-lista">
                {consultas.map((q) => (
                  <li key={q.id}>
                    <span>{q.pergunta}</span>
                    <span>{q.status} · {dia(q.criadoEm)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="mesa-cartao mesa-entra" style={ordem(1)}>
            <h2>Pessoas incluídas</h2>
            <p>Incluir mostra o caso a quem, pelo nível, não o veria.</p>
            {caso.incluidos.length === 0 ? (
              <p className="mesa-nota">Ninguém incluído.</p>
            ) : (
              <ul className="mesa-lista" style={{ padding: 0, boxShadow: "none" }}>
                {caso.incluidos.map((id) => (
                  <li key={id}>
                    <span className="mesa-pessoa-quem">
                      <Avatar nome={nomeDe(e, id)} />
                      <strong>{nomeDe(e, id)}</strong>
                    </span>
                    <button
                      type="button"
                      className="mesa-botao secundario"
                      style={{ minHeight: 34, padding: "6px 14px", fontSize: 13 }}
                      onClick={() => alterar((x) => ({ ...x, casos: x.casos.map((c) => (c.id === caso.id ? { ...c, incluidos: c.incluidos.filter((i) => i !== id) } : c)) }), "retirada_caso", `${nomeDe(e, id)} em ${caso.titulo}`)}
                    >
                      Retirar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {candidatos.length > 0 && (
              <form
                className="mesa-sub"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const id = String(new FormData(ev.currentTarget).get("usuario") ?? "");
                  if (!id) return avisar("Escolha quem incluir.");
                  alterar((x) => ({ ...x, casos: x.casos.map((c) => (c.id === caso.id ? { ...c, incluidos: [...c.incluidos, id] } : c)) }), "inclusao_caso", `${nomeDe(e, id)} em ${caso.titulo}`);
                  avisar(`${nomeDe(e, id)} foi incluído no caso.`);
                }}
              >
                <div className="campo">
                  <label htmlFor="incluir">Incluir colega</label>
                  <Seletor id="incluir" name="usuario" opcoes={candidatos.map((p) => ({ valor: p.id, rotulo: p.nome, descricao: ROTULO_NIVEL[p.nivel] }))} />
                </div>
                <div className="mesa-form-pe"><button className="mesa-botao">Incluir</button></div>
              </form>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Cabeca trilha={`${e.escritorio.nome} / Casos`} titulo="Casos" descricao="Cada caso aparece para quem o criou, para quem tem nível igual ou acima, e para quem for incluído nele." />
      {aviso && <p className="alerta info mesa-entra" role="status">{aviso}</p>}
      <div className="mesa-grade-2" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)" }}>
        <section className="bloco" aria-label="Casos">
          {e.casos.length === 0 ? (
            <p className="mesa-vazio-cartao mesa-entra">Nenhum caso ainda. Crie o primeiro ao lado.</p>
          ) : (
            <div className="mesa-casos">
              {e.casos.map((c, i) => (
                <button key={c.id} type="button" className="mesa-caso mesa-entra" style={{ ...ordem(i), textAlign: "left", border: 0, font: "inherit", cursor: "pointer" }} onClick={() => setAberto(c.id)}>
                  <h2>{c.titulo}</h2>
                  <p>
                    {c.cliente ? `${c.cliente} · ` : ""}
                    {c.autor === eu.id ? "seu" : `de ${nomeDe(e, c.autor)}`} · {dia(c.criadoEm)}
                  </p>
                  <p>
                    {e.consultas.filter((q) => q.caso === c.id).length} consultas · {c.incluidos.length} incluídos
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
        <form className="mesa-cartao mesa-entra" style={ordem(1)} onSubmit={criar} noValidate>
          <h2>Novo caso</h2>
          <div className="campo">
            <label htmlFor="caso-titulo">Título</label>
            <input id="caso-titulo" name="titulo" placeholder="Ex.: Transição do Simples, cliente X" />
          </div>
          <div className="campo">
            <label htmlFor="caso-cliente">Cliente (opcional)</label>
            <input id="caso-cliente" name="cliente" />
          </div>
          <div className="mesa-form-pe"><button className="mesa-botao">Criar caso</button></div>
        </form>
      </div>
    </>
  );
}
