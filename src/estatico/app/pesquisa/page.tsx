import { CabecaDemo } from "@/components/demo/ComEscritorio";
import { PesquisaDemo } from "@/components/demo/PesquisaDemo";

export const metadata = { title: "Pesquisa — demonstração AdvFin" };

export default function PesquisaPaginaDemo() {
  return (
    <>
      <CabecaDemo secao="Pesquisa" titulo="Pesquisa fundamentada" />
      <PesquisaDemo />
    </>
  );
}
