"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FormEvent } from "react";
import { Cabeca } from "@/components/app/Cabeca";
import { Avatar } from "@/components/app/NavegacaoMesa";
import { Seletor } from "@/components/ui/Seletor";
import { ROTULO_NIVEL, acimaOuIgual } from "@/lib/auth/niveis";
import { alterar, agora, euDe, nomeDe, novoId, useDemo } from "./estado";
import { useConversas } from "./conversas";
import { Icone } from "@/components/app/Icone";
import { useAviso } from "./PerfilDemo";

const dia = (s: string) => new Date(s).toLocaleDateString("pt-BR");
const quando = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const ordem = (i: number) => ({ "--i": i }) as CSSProperties;

/** Casos da demonstração: criar, abrir, incluir colegas e ver as consultas feitas no caso. */
export function CasosDemo() {
  const e = useDemo();
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, avisar] = useAviso();
  const conversasTodas = useConversas();
  const router = useRouter();
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
    const conversas = conversasTodas.filter((c) => c.caso === caso.id);
    const soPerguntas = e.consultas.filter((c) => c.caso === caso.id && !conversas.some((v) => v.turnos.some((t) => t.texto === c.pergunta)));
    const candidatos = e.pessoas.filter((p) => p.situacao === "ativo" && p.id !== caso.autor && !caso.incluidos.includes(p.id) && !acimaOuIgual(p.nivel, "membro"));
    const notas = [...(caso.notas ?? [])].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
    const podeApagar = (autor: string) => autor === eu.id || acimaOuIgual(eu.nivel, "admin");
    const perguntar = (ev: FormEvent<HTMLFormElement>) => {
      ev.preventDefault();
      const q = String(new FormData(ev.currentTarget).get("q") ?? "").trim();
      if (q.length < 2) return avisar("Escreva a pergunta sobre o caso.");
      router.push(`/app/pesquisa/?caso=${encodeURIComponent(caso.id)}&q=${encodeURIComponent(q)}`);
    };
    const anotar = (ev: FormEvent<HTMLFormElement>) => {
      ev.preventDefault();
      const form = ev.currentTarget;
      const texto = String(new FormData(form).get("nota") ?? "").trim();
      if (!texto) return avisar("Escreva a nota antes de salvar.");
      const nota = { id: novoId(), autor: eu.id, texto: texto.slice(0, 4000), criadoEm: agora() };
      alterar((x) => ({ ...x, casos: x.casos.map((c) => (c.id === caso.id ? { ...c, notas: [...(c.notas ?? []), nota] } : c)) }), "nota_caso", caso.titulo);
      form.reset();
    };
    return (
      <>
        <button type="button" className="mesa-voltar" onClick={() => setAberto(null)}>
          <span aria-hidden="true">←</span> Todos os casos
        </button>
        <Cabeca trilha={`${e.escritorio.nome} / Casos / ${caso.titulo}`} titulo={caso.titulo} descricao={`${caso.cliente ? `${caso.cliente} · ` : ""}criado por ${caso.autor === eu.id ? "você" : nomeDe(e, caso.autor)} em ${dia(caso.criadoEm)} · visível para Membros para cima e para quem for incluído`} />
        <form className="mesa-campo compositor caso-pergunta mesa-entra" onSubmit={perguntar}>
          <label htmlFor="caso-q" className="so-leitor">Pergunte sobre este caso</label>
          <textarea
            id="caso-q"
            name="q"
            rows={1}
            maxLength={2000}
            placeholder="Pergunte sobre este caso…"
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                ev.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="app-enviar compositor-enviar" aria-label="Pesquisar neste caso" title="Pesquisar neste caso (Enter)">
            <Icone nome="enviar" />
          </button>
        </form>
        {aviso && <p className="alerta info mesa-entra" role="status">{aviso}</p>}
        <div className="mesa-grade-2 lado-largo">
          <div className="caso-coluna">
          <section className="bloco mesa-entra">
            <p className="mesa-rotulo">Conversas do caso</p>
            {conversas.length === 0 && soPerguntas.length === 0 ? (
              <p className="mesa-vazio-cartao">Nenhuma pesquisa neste caso ainda. Pergunte na barra acima.</p>
            ) : (
              <ul className="caso-conversas">
                {conversas.map((v) => {
                  const ultimo = v.turnos[v.turnos.length - 1];
                  const d = ultimo?.desfecho;
                  const trecho = d && "paragrafos" in d ? d.paragrafos.join(" ").replace(/\[D\d{1,2}\]/g, "").slice(0, 180) : d && "mensagem" in d ? d.mensagem : "";
                  return (
                    <li key={v.id}>
                      <Link href={`/app/pesquisa/?conversa=${encodeURIComponent(v.id)}`} className="caso-conversa">
                        <strong>{v.turnos[0]?.texto}</strong>
                        {trecho && <span className="caso-conversa-resposta">{trecho}{trecho.length >= 180 ? "…" : ""}</span>}
                        <span className="caso-conversa-meta">
                          {v.turnos.length} {v.turnos.length === 1 ? "pergunta" : "perguntas"} · {quando(v.atualizadaEm)} · continuar a conversa →
                        </span>
                      </Link>
                    </li>
                  );
                })}
                {soPerguntas.map((q) => (
                  <li key={q.id} className="caso-conversa caso-conversa-antiga">
                    <strong>{q.pergunta}</strong>
                    <span className="caso-conversa-meta">{q.status} · {dia(q.criadoEm)} · resposta de antes desta versão, não guardada</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="bloco mesa-entra" style={ordem(1)} aria-labelledby="notas-titulo">
            <p className="mesa-rotulo" id="notas-titulo">Notas da equipe</p>
            {notas.length === 0 ? (
              <p className="mesa-vazio-cartao">Nenhuma nota ainda. Conte à equipe o que você fez ou o que falta no caso.</p>
            ) : (
              <ol className="caso-notas">
                {notas.map((n) => (
                  <li key={n.id} className="caso-nota">
                    <Avatar nome={nomeDe(e, n.autor)} />
                    <div>
                      <p className="caso-nota-topo">
                        <strong>{n.autor === eu.id ? "Você" : nomeDe(e, n.autor)}</strong>
                        <time dateTime={n.criadoEm}>{quando(n.criadoEm)}</time>
                        {podeApagar(n.autor) && (
                          <button
                            type="button"
                            className="caso-nota-apagar"
                            onClick={() => alterar((x) => ({ ...x, casos: x.casos.map((c) => (c.id === caso.id ? { ...c, notas: (c.notas ?? []).filter((y) => y.id !== n.id) } : c)) }), "nota_apagada", caso.titulo)}
                          >
                            Apagar
                          </button>
                        )}
                      </p>
                      <p className="caso-nota-texto">{n.texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <form className="caso-nota-nova" onSubmit={anotar}>
              <label htmlFor="nota" className="so-leitor">Nova nota</label>
              <textarea id="nota" name="nota" rows={2} maxLength={4000} placeholder="Escreva uma nota para a equipe… (só texto; documentos ficam fora, por sigilo)" />
              <div className="mesa-form-pe"><button className="mesa-botao">Salvar nota</button></div>
            </form>
          </section>
          </div>
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
      <div className="mesa-grade-2 lado-largo">
        <section className="bloco" aria-label="Casos">
          {e.casos.length === 0 ? (
            <p className="mesa-vazio-cartao mesa-entra">Nenhum caso ainda. Crie o primeiro no formulário de novo caso.</p>
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
