import { Cabeca } from "@/components/app/Cabeca";
import { Pesquisa } from "@/components/app/Pesquisa";
import { exigirSessao } from "@/lib/auth/sessao";

export const metadata = { title: "Pesquisa — AdvFin" };

export default async function PaginaPesquisa() {
  const s = await exigirSessao();
  return (
    <>
      <Cabeca trilha={`${s.escritorio} / Pesquisa`} titulo="Pesquisa fundamentada" />
      <Pesquisa />
    </>
  );
}
