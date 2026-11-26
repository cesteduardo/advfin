import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { BotaoExportar } from "@/components/app/BotaoExportar";
import { exigirSessao } from "@/lib/auth/sessao";
import { noEscritorio } from "@/lib/db";

export const metadata = { title: "Parecer — AdvFin" };

const dataBR = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const STATUS: Record<string, string> = { bloqueada_citacao: "bloqueada pelo verificador", erro: "com erro", pendente: "em andamento" };

/**
 * A consulta como parecer: cabeçalho com o logo do escritório, a resposta com as citações
 * numeradas, os dispositivos com o trecho e a vigência, e a assinatura de quem consultou.
 */
export default async function Parecer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await exigirSessao();
  const d = await noEscritorio(s, async (c) => {
    const [q] = (await c.query(`select * from consultas where id = $1`, [id])).rows;
    if (!q) return null;
    const fontes = (await c.query(`select * from app.fontes_da_consulta($1)`, [id])).rows;
    const [autor] = (await c.query(`select nome, cargo, oab from app.pessoas() where usuario_id = $1`, [q.usuario_id])).rows;
    const [nomeAutor] = autor ? [autor] : (await c.query(`select nome from app.autores($1)`, [[q.usuario_id]])).rows;
    const caso = q.caso_id ? (await c.query(`select id, titulo from casos where id = $1`, [q.caso_id])).rows[0] : null;
    const revisao = (
      await c.query(
        `select status from revisoes where acao = 'exportar_parecer' and solicitante = $1 and alvo = jsonb_build_object('consulta', $2::uuid)
         order by criado_em desc limit 1`,
        [s.usuarioId, id],
      )
    ).rows[0]?.status as string | undefined;
    return { q, fontes, autor: autor ?? nomeAutor, caso, revisao };
  });
  if (!d) notFound();

  const { q } = d;
  const porId = new Map(d.fontes.map((f: any) => [f.id, f]));
  const citacoes: { ref: string; dispositivo_id: string; trecho: string }[] = q.citacoes ?? [];
  const numero = new Map(citacoes.map((c, i) => [c.ref, i + 1]));
  const provisorio = d.fontes.some((f: any) => f.origem === "semente" || f.status_curadoria !== "publicado");
  const estado = s.pode.has("exportar_parecer") ? "livre" : d.revisao === "aprovada" ? "aprovada" : d.revisao === "pendente" ? "pendente" : "revisao";

  return (
    <article className="parecer">
      <div className="parecer-barra mesa-acoes">
        <Link href={d.caso ? `/app/casos/${d.caso.id}` : "/app"}>← {d.caso ? d.caso.titulo : "Início"}</Link>
      </div>
      <header className="parecer-cabeca">
        {s.logo ? <img src={s.logo} alt={s.escritorio} /> : <strong>{s.escritorio}</strong>}
        <p>
          Consulta de {dataBR(q.criado_em)}
          <br />
          Normas vigentes em {dataBR(q.data_referencia)}
        </p>
      </header>

      <h2>{q.pergunta}</h2>

      {q.status !== "respondida" ? (
        <p className="alerta aviso">Esta consulta está {STATUS[q.status] ?? q.status}; não há parecer para exportar.</p>
      ) : (
        <>
          {provisorio && (
            <p className="alerta aviso">Há fontes ainda não conferidas pelo tributarista curador. Use como ponto de partida, não em peça.</p>
          )}
          <div className="parecer-texto">
            {String(q.resposta ?? "")
              .split(/\n{2,}/)
              .map((p, i) => (
                <p key={i}>
                  {p.split(/(\[D\d{1,2}\])/).map((parte, j) => {
                    const m = /^\[(D\d{1,2})\]$/.exec(parte);
                    return m ? <sup key={j}>{numero.get(m[1]) ?? m[1].slice(1)}</sup> : <Fragment key={j}>{parte}</Fragment>;
                  })}
                </p>
              ))}
          </div>
          {citacoes.length > 0 && (
            <section className="bloco">
              <p className="mesa-rotulo">Fontes</p>
              <ol className="parecer-fontes">
                {citacoes.map((c) => {
                  const f: any = porId.get(c.dispositivo_id);
                  return (
                    <li key={c.ref}>
                      <strong>{f ? `${f.norma}, ${f.rotulo}` : "Dispositivo"}</strong>
                      {f && (
                        <>
                          {" · "}vigente desde {dataBR(f.vigencia_inicio)}
                          {f.vigencia_fim ? ` até ${dataBR(f.vigencia_fim)}` : ""}
                          {f.status_curadoria !== "publicado" ? " · não conferido pelo curador" : ""}
                        </>
                      )}
                      <blockquote>“{c.trecho}”</blockquote>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          <p className="parecer-assinatura">
            {d.autor?.nome ?? "—"}
            {d.autor?.cargo ? `, ${d.autor.cargo}` : ""}
            {d.autor?.oab ? ` · OAB ${d.autor.oab}` : ""}
            <br />
            Preparado com o AdvFin. A IA prepara, o advogado decide.
          </p>
          <BotaoExportar consulta={id} estadoInicial={estado} />
        </>
      )}
    </article>
  );
}
