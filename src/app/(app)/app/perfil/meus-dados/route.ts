import { sessaoAtual } from "@/lib/auth/sessao";
import { comoUsuario } from "@/lib/db";

/** Portabilidade (LGPD, art. 18, V): os dados da própria pessoa, em JSON. */
export async function GET() {
  const s = await sessaoAtual();
  if (!s) return new Response("Entre para baixar seus dados.", { status: 401 });
  const dados = await comoUsuario(s.usuarioId, async (c) => (await c.query(`select app.exportar_meus_dados() d`)).rows[0].d);
  const dia = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="advfin-meus-dados-${dia}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
