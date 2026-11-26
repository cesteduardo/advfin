import { sessaoAtual } from "@/lib/auth/sessao";
import { paraCsv } from "@/lib/csv";
import { noEscritorio } from "@/lib/db";

const TABELAS = ["consultas", "casos", "simulacoes", "membros", "auditoria", "documentos_privados", "convites", "revisoes", "casos_membros"] as const;

/** Portabilidade do escritório (só Titular): JSON completo ou o CSV de uma tabela. A exportação é auditada no banco. */
export async function GET(req: Request) {
  const s = await sessaoAtual();
  if (!s) return new Response("Entre para exportar.", { status: 401 });
  if (!s.pode.has("exportar_escritorio")) return new Response("Só o Titular exporta os dados do escritório.", { status: 403 });
  const url = new URL(req.url);
  const formato = url.searchParams.get("formato") === "csv" ? "csv" : "json";
  const tabela = url.searchParams.get("tabela") as (typeof TABELAS)[number];
  if (formato === "csv" && !TABELAS.includes(tabela)) return new Response("Tabela desconhecida.", { status: 400 });

  const dados = await noEscritorio(s, async (c) => (await c.query(`select app.exportar_escritorio() d`)).rows[0].d);
  const dia = new Date().toISOString().slice(0, 10);
  const nome = `advfin-${s.escritorio.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}-${dia}`;
  if (formato === "json") {
    return new Response(JSON.stringify(dados, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}.json"`, "Cache-Control": "no-store" },
    });
  }
  return new Response(paraCsv(dados[tabela] ?? []), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}-${tabela}.csv"`, "Cache-Control": "no-store" },
  });
}
