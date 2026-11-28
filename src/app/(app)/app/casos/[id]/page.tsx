import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabeca } from "@/components/app/Cabeca";
import { FormAcao } from "@/components/app/FormAcao";
import { Avatar } from "@/components/app/NavegacaoMesa";
import { Revisoes } from "@/components/app/casos/Revisoes";
import { ROTULO_NIVEL, acimaOuIgual, type Nivel } from "@/lib/auth/niveis";
import { exigirSessao } from "@/lib/auth/sessao";
import { anotarCaso, apagarNotaCaso, incluirNoCaso, retirarDoCaso } from "@/lib/casos/acoes";
import { PerguntaCaso } from "@/components/app/casos/PerguntaCaso";
import { lerRevisoes, visibilidade } from "@/lib/casos/consultas";
import { noEscritorio } from "@/lib/db";
import { Seletor } from "@/components/ui/Seletor";

export const metadata = { title: "Caso — AdvFin" };

const quando = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const dia = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const STATUS: Record<string, string> = { respondida: "Respondida", bloqueada_citacao: "Bloqueada pelo verificador", erro: "Erro", pendente: "Em andamento" };

export default async function Caso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await exigirSessao();
  const d = await noEscritorio(s, async (c) => {
    // A RLS decide: caso que a pessoa não vê simplesmente não volta.
    const [caso] = (await c.query(`select * from casos where id = $1`, [id])).rows;
    if (!caso) return null;
    const incluidos = (await c.query(`select usuario_id, incluido_em from casos_membros where caso_id = $1 order by incluido_em`, [id])).rows;
    const consultas = (await c.query(`select id, pergunta, status, usuario_id, criado_em from consultas where caso_id = $1 order by criado_em desc`, [id])).rows;
    const notas = (await c.query(`select id, autor_id, texto, criado_em from casos_notas where caso_id = $1 order by criado_em`, [id])).rows;
    const pessoas = (await c.query(`select usuario_id, nome, cargo, nivel, foto_url from app.pessoas() where suspenso_em is null`)).rows;
    const ids = [...new Set([caso.criado_por, ...consultas.map((x) => x.usuario_id), ...notas.map((x) => x.autor_id)].filter(Boolean))];
    const nomes = new Map<string, string>((await c.query(`select * from app.autores($1)`, [ids])).rows.map((x) => [x.usuario_id, x.nome]));
    return { caso, incluidos, consultas, notas, pessoas, nomes, revisoes: await lerRevisoes(c, { caso: id }) };
  });
  if (!d) notFound();

  const pessoa = new Map(d.pessoas.map((p: any) => [p.usuario_id, p]));
  const incluidos = new Set(d.incluidos.map((x: any) => x.usuario_id));
  // Quem já vê o caso pelo nível não precisa ser incluído; a lista oferece só quem ainda não vê.
  const candidatos = d.pessoas.filter(
    (p: any) => p.usuario_id !== d.caso.criado_por && !incluidos.has(p.usuario_id) && !acimaOuIgual(p.nivel, d.caso.nivel_minimo),
  );
  const podeRetirar = d.caso.criado_por === s.usuarioId || acimaOuIgual(s.nivel, "admin");
  const pedeRevisao = s.comRevisao.has("incluir_colega");

  return (
    <>
      <Link className="mesa-voltar" href="/app/casos">
        <span aria-hidden="true">←</span> Todos os casos
      </Link>
      <Cabeca
        trilha={`${s.escritorio} / Casos / ${d.caso.titulo}`}
        titulo={d.caso.titulo}
        descricao={`${d.caso.cliente ? `${d.caso.cliente} · ` : ""}criado por ${d.caso.criado_por === s.usuarioId ? "você" : (d.nomes.get(d.caso.criado_por) ?? "—")} em ${dia(d.caso.criado_em)} · ${visibilidade(d.caso.nivel_minimo)}`}
      />
      <PerguntaCaso caso={id} />

      <Revisoes linhas={d.revisoes} decide={acimaOuIgual(s.nivel, "membro")} euId={s.usuarioId} />

      <div className="mesa-grade-2 lado-largo">
        <div className="caso-coluna">
        <section className="bloco" aria-labelledby="consultas-caso">
          <p className="mesa-rotulo" id="consultas-caso">Consultas do caso</p>
          {d.consultas.length === 0 ? (
            <p className="mesa-vazio-cartao">Nenhuma consulta neste caso ainda.</p>
          ) : (
            <ul className="mesa-lista">
              {d.consultas.map((q: any) => (
                <li key={q.id}>
                  <Link href={`/app/consultas/${q.id}`}>{q.pergunta}</Link>
                  <span>
                    {STATUS[q.status] ?? q.status} · {d.nomes.get(q.usuario_id) ?? "—"} · {dia(q.criado_em)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bloco" aria-labelledby="notas-titulo">
          <p className="mesa-rotulo" id="notas-titulo">Notas da equipe</p>
          {d.notas.length === 0 ? (
            <p className="mesa-vazio-cartao">Nenhuma nota ainda. Conte à equipe o que você fez ou o que falta no caso.</p>
          ) : (
            <ol className="caso-notas">
              {d.notas.map((n: any) => {
                const nome = n.autor_id === s.usuarioId ? "Você" : (d.nomes.get(n.autor_id) ?? "Ex-membro");
                const pode = n.autor_id === s.usuarioId || acimaOuIgual(s.nivel, "admin");
                return (
                  <li key={n.id} className="caso-nota">
                    <Avatar nome={nome} foto={(pessoa.get(n.autor_id) as any)?.foto_url} />
                    <div>
                      <p className="caso-nota-topo">
                        <strong>{nome}</strong>
                        <time dateTime={new Date(n.criado_em).toISOString()}>{quando(n.criado_em)}</time>
                        {pode && (
                          <form action={apagarNotaCaso} style={{ marginLeft: "auto" }}>
                            <input type="hidden" name="id" value={n.id} />
                            <button className="caso-nota-apagar">Apagar</button>
                          </form>
                        )}
                      </p>
                      <p className="caso-nota-texto">{n.texto}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <FormAcao acao={anotarCaso} botao="Salvar nota" pendente="Salvando…" classe="caso-nota-nova">
            <input type="hidden" name="caso" value={id} />
            <label htmlFor="nota" className="so-leitor">Nova nota</label>
            <textarea id="nota" name="texto" rows={2} maxLength={4000} placeholder="Escreva uma nota para a equipe… (só texto; documentos ficam fora, por sigilo)" />
          </FormAcao>
        </section>
        </div>

        <div className="mesa-coluna">
          <div className="mesa-cartao">
            <h2>Pessoas incluídas</h2>
            <p>Incluir mostra o caso a quem, pelo nível, não o veria.</p>
            {d.incluidos.length === 0 ? (
              <p className="mesa-nota">Ninguém incluído.</p>
            ) : (
              <ul className="mesa-lista" style={{ padding: 0, boxShadow: "none" }}>
                {d.incluidos.map((x: any) => {
                  const p: any = pessoa.get(x.usuario_id);
                  return (
                    <li key={x.usuario_id}>
                      <span className="mesa-pessoa-quem">
                        <Avatar nome={p?.nome ?? "?"} foto={p?.foto_url} />
                        <span>
                          <strong>{p?.nome ?? "Ex-membro"}</strong>
                          <small className="mesa-nota">{p ? ROTULO_NIVEL[p.nivel as Nivel] : ""}</small>
                        </span>
                      </span>
                      {podeRetirar && (
                        <form action={retirarDoCaso}>
                          <input type="hidden" name="caso" value={id} />
                          <input type="hidden" name="usuario" value={x.usuario_id} />
                          <button className="mesa-botao secundario" style={{ minHeight: 34, padding: "6px 14px", fontSize: 13 }}>Retirar</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {candidatos.length > 0 && (s.pode.has("incluir_colega") || pedeRevisao) && (
              <FormAcao acao={incluirNoCaso} botao={pedeRevisao ? "Pedir para incluir" : "Incluir"} pendente="…" classe="mesa-sub">
                <input type="hidden" name="caso" value={id} />
                <div className="campo">
                  <label htmlFor="incluir">Incluir colega</label>
                  <Seletor id="incluir" name="usuario" opcoes={candidatos.map((p: any) => ({ valor: p.usuario_id, rotulo: p.nome, descricao: ROTULO_NIVEL[p.nivel as Nivel] }))} />
                </div>
                {pedeRevisao && <p className="mesa-nota">Como Supervisionado, a inclusão vale depois que um Membro aprovar.</p>}
              </FormAcao>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
