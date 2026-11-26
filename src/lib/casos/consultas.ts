import "server-only";
import type { PoolClient } from "pg";
import type { RevisaoLinha } from "@/components/app/casos/Revisoes";
import { ROTULO_NIVEL, type Nivel } from "@/lib/auth/niveis";

/** Para quem o caso aparece, em palavras. */
export function visibilidade(nivelMinimo: Nivel): string {
  return nivelMinimo === "admin" ? "Visível para Administradores e o Titular, e para quem for incluído" : "Visível para Membros para cima, e para quem for incluído";
}

export const rotuloNivel = (n: Nivel) => ROTULO_NIVEL[n];

/** Revisões que a pessoa vê (RLS), já com nomes e o que se pede, para a lista. */
export async function lerRevisoes(c: PoolClient, filtro: { soPendentes?: boolean; caso?: string } = {}): Promise<RevisaoLinha[]> {
  const { rows } = await c.query(
    `select r.id, r.acao, r.status, r.solicitante, r.alvo, r.nota, r.criado_em,
            (select titulo from casos where id = (r.alvo->>'caso')::uuid) as caso_titulo,
            (select pergunta from consultas where id = (r.alvo->>'consulta')::uuid) as pergunta
     from revisoes r
     where ($1::boolean is not true or r.status = 'pendente')
       and ($2::uuid is null or r.alvo->>'caso' = $2::text)
     order by r.status = 'pendente' desc, r.criado_em desc limit 30`,
    [filtro.soPendentes ?? false, filtro.caso ?? null],
  );
  const ids = [...new Set(rows.flatMap((r) => [r.solicitante, r.alvo?.usuario]).filter(Boolean))];
  const nomes = new Map<string, string>(ids.length ? (await c.query(`select * from app.autores($1)`, [ids])).rows.map((x) => [x.usuario_id, x.nome]) : []);
  return rows.map((r) => ({
    id: r.id,
    acao: r.acao,
    status: r.status,
    solicitante: r.solicitante,
    nomeSolicitante: nomes.get(r.solicitante) ?? "—",
    nota: r.nota,
    criado_em: r.criado_em,
    descricao:
      r.acao === "exportar_parecer"
        ? `exportar o parecer “${(r.pergunta ?? "consulta").slice(0, 90)}”`
        : `incluir ${nomes.get(r.alvo?.usuario) ?? "um colega"} no caso “${r.caso_titulo ?? "—"}”`,
    href: r.acao === "exportar_parecer" ? `/app/consultas/${r.alvo.consulta}` : r.alvo?.caso ? `/app/casos/${r.alvo.caso}` : null,
  }));
}
