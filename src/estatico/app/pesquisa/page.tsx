import { Cabeca } from "@/components/app/Cabeca";
import { PesquisaDemo } from "@/components/demo/PesquisaDemo";

export const metadata = { title: "Pesquisa — demonstração AdvFin" };

export default function PesquisaPaginaDemo() {
  return (
    <>
      <Cabeca trilha="Escritório de demonstração / Pesquisa" titulo="Pesquisa fundamentada" />
      <PesquisaDemo />
    </>
  );
}
