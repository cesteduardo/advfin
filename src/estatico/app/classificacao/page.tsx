import { CabecaDemo } from "@/components/demo/ComEscritorio";
import { Classificacao } from "@/components/app/Classificacao";

export const metadata = { title: "Classificação NCM/NBS — demonstração AdvFin" };

export default function ClassificacaoDemo() {
  return (
    <>
      <CabecaDemo
        secao="NCM/NBS"
        titulo="Classificação NCM/NBS"
        descricao="Busque pelo código (o prefixo mais específico vence) ou pela descrição. Nada aqui é escolhido por IA."
      />
      <Classificacao />
    </>
  );
}
