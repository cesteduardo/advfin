import { sessaoAtual } from "@/lib/auth/sessao";
import { paraCsv } from "@/lib/csv";
import { noEscritorio } from "@/lib/db";
import { ROTULO_ACAO } from "@/lib/escritorio/rotulos";

/** A trilha filtrada, em CSV. Quem não é Admin nem Titular recebe só as próprias linhas (RLS). */
export async function GET(req: Request) {
  const s = await sessaoAtual();
  if (!s) return new Response("Entre para exportar.", { status: 401 });
  if (!s.pode.has("ver_auditoria")) return new Response("Sem acesso à auditoria do escritório.", { status: 403 });
  const p = new URL(req.url).searchParams;
  const val = (k: string, re: RegExp) => (re.test(p.get(k) ?? "") ? p.get(k) : null);
  const uuid = /^[0-9a-f-]{36}$/i, data = /^\d{4}-\d{2}-\d{2}$/, acao = /^[a-z_0-9]{1,40}$/;
  const linhas = await noEscritorio(s, async (c) => {
    const { rows } = await c.query(
      `select a.criado_em, a.usuario_id, a.acao, a.alvo_id, a.detalhes from auditoria a
       where ($1::uuid is null or a.usuario_id = $1) and ($2::text is null or a.acao = $2)
         and ($3::date is null or a.criado_em >= $3::date) and ($4::date is null or a.criado_em < $4::date + 1)
       order by a.id`,
      [val("pessoa", uuid), val("acao", acao), val("de", data), val("ate", data)],
    );
    const ids = [...new Set(rows.map((r) => r.usuario_id).filter(Boolean))];
    const nomes = new Map<string, string>(ids.length ? (await c.query(`select * from app.autores($1)`, [ids])).rows.map((x) => [x.usuario_id, x.nome]) : []);
    await c.query(`insert into auditoria (escritorio_id, usuario_id, acao, detalhes) values ($1, $2, 'exportacao_auditoria', $3)`, [s.escritorioId, s.usuarioId, JSON.stringify({ linhas: rows.length })]);
    return rows.map((r) => ({
      quando: r.criado_em,
      quem: r.usuario_id ? (nomes.get(r.usuario_id) ?? "") : "Sistema",
      acao: ROTULO_ACAO[r.acao] ?? r.acao,
      codigo: r.acao,
      alvo: r.alvo_id,
      detalhes: r.detalhes,
    }));
  });
  return new Response(paraCsv(linhas, ["quando", "quem", "acao", "codigo", "alvo", "detalhes"]), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="advfin-auditoria-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
