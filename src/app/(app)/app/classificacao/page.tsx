import { Cabeca } from "@/components/app/Cabeca";
import { Classificacao } from "@/components/app/Classificacao";
import { exigirSessao } from "@/lib/auth/sessao";

export const metadata = { title: "Classificação NCM/NBS — AdvFin" };

export default async function PaginaClassificacao() {
  const s = await exigirSessao();
  return (
    <>
      <Cabeca
        trilha={`${s.escritorio} / NCM/NBS`}
        titulo="Classificação NCM/NBS"
        descricao="Busque pelo código (o prefixo mais específico vence) ou pela descrição. Nada aqui é escolhido por IA."
      />
      <Classificacao />
    </>
  );
}
