import Link from "next/link";
import { Cabeca } from "@/components/app/Cabeca";
import { FormAcao } from "@/components/app/FormAcao";
import { Revisoes } from "@/components/app/casos/Revisoes";
import { acimaOuIgual } from "@/lib/auth/niveis";
import { exigirSessao } from "@/lib/auth/sessao";
import { criarCaso } from "@/lib/casos/acoes";
import { lerRevisoes, visibilidade } from "@/lib/casos/consultas";
import { noEscritorio } from "@/lib/db";

export const metadata = { title: "Casos — AdvFin" };

const dia = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default async function Casos() {
  const s = await exigirSessao();
  const decide = acimaOuIgual(s.nivel, "membro");
  const { casos, nomes, revisoes } = await noEscritorio(s, async (c) => {
    const { rows } = await c.query(
      `select c.id, c.titulo, c.cliente, c.criado_por, c.criado_em, c.nivel_minimo,
              (select count(*)::int from consultas q where q.caso_id = c.id) as consultas,
              (select count(*)::int from casos_membros m where m.caso_id = c.id) as incluidos,
              exists (select 1 from casos_membros m where m.caso_id = c.id and m.usuario_id = $1) as incluido
       from casos c order by c.criado_em desc`,
      [s.usuarioId],
    );
    const ids = [...new Set(rows.map((r) => r.criado_por).filter(Boolean))];
    const nomes = new Map<string, string>(ids.length ? (await c.query(`select * from app.autores($1)`, [ids])).rows.map((x) => [x.usuario_id, x.nome]) : []);
    return { casos: rows, nomes, revisoes: await lerRevisoes(c, { soPendentes: decide }) };
  });

  return (
    <>
      <Cabeca
        trilha={`${s.escritorio} / Casos`}
        titulo="Casos"
        descricao="Cada caso aparece para quem o criou, para quem tem nível igual ou acima, e para quem for incluído nele."
      />
      <Revisoes linhas={revisoes} decide={decide} euId={s.usuarioId} />
      <div className="mesa-grade-2" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)" }}>
        <section className="bloco" aria-label="Casos visíveis para você">
          {casos.length === 0 ? (
            <p className="mesa-vazio-cartao">Nenhum caso que você possa ver. Crie o primeiro ao lado.</p>
          ) : (
            <div className="mesa-casos">
              {casos.map((c: any) => (
                <Link key={c.id} href={`/app/casos/${c.id}`} className="mesa-caso">
                  <h2>{c.titulo}</h2>
                  <p>
                    {c.cliente ? `${c.cliente} · ` : ""}
                    {c.criado_por === s.usuarioId ? "seu" : `de ${nomes.get(c.criado_por) ?? "—"}`} · {dia(c.criado_em)}
                  </p>
                  <p>
                    {c.consultas} {c.consultas === 1 ? "consulta" : "consultas"} · {c.incluidos} {c.incluidos === 1 ? "pessoa incluída" : "pessoas incluídas"}
                  </p>
                  <p>{c.incluido && c.criado_por !== s.usuarioId ? "Você foi incluído" : visibilidade(c.nivel_minimo)}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
        {s.pode.has("criar_caso") && (
          <FormAcao acao={criarCaso} botao="Criar caso" pendente="Criando…">
            <h2>Novo caso</h2>
            <div className="campo">
              <label htmlFor="caso-titulo">Título</label>
              <input id="caso-titulo" name="titulo" required maxLength={160} placeholder="Ex.: Transição do Simples, cliente X" />
            </div>
            <div className="campo">
              <label htmlFor="caso-cliente">Cliente (opcional)</label>
              <input id="caso-cliente" name="cliente" maxLength={160} />
            </div>
            <p className="mesa-nota">{visibilidade(acimaOuIgual(s.nivel, "admin") ? "admin" : "membro")}.</p>
          </FormAcao>
        )}
      </div>
    </>
  );
}
