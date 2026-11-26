import { Cabeca } from "@/components/app/Cabeca";
import { Classificacao } from "@/components/app/Classificacao";

export const metadata = { title: "Classificação NCM/NBS — demonstração AdvFin" };

export default function ClassificacaoDemo() {
  return (
    <>
      <Cabeca
        trilha="Escritório de demonstração / NCM/NBS"
        titulo="Classificação NCM/NBS"
        descricao="Busque pelo código (o prefixo mais específico vence) ou pela descrição. Nada aqui é escolhido por IA."
      />
      <Classificacao />
    </>
  );
}
