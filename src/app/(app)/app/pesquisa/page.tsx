import { Pesquisa } from "@/components/app/Pesquisa";
import { exigirSessao, vigenciaPadrao } from "@/lib/auth/sessao";
import { noEscritorio } from "@/lib/db";

export const metadata = { title: "Pesquisa — AdvFin" };

export default async function PaginaPesquisa({ searchParams }: { searchParams: Promise<{ caso?: string }> }) {
  const s = await exigirSessao();
  const { caso } = await searchParams;
  // Só os casos que a pessoa vê (RLS); o banco recusa de novo um caso invisível na hora de gravar.
  const casos = await noEscritorio(s, async (c) => (await c.query(`select id, titulo from casos order by criado_em desc limit 100`)).rows);
  return (
    <>
      <h1 className="so-leitor">Pesquisa fundamentada</h1>
      <Pesquisa nome={s.nome.split(" ")[0]} dataInicial={vigenciaPadrao(s.preferencias)} casos={casos} casoInicial={casos.some((c) => c.id === caso) ? caso : undefined} />
    </>
  );
}
