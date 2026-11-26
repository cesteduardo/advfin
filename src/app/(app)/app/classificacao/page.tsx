import { Classificacao } from "@/components/app/Classificacao";

export const metadata = { title: "Classificação NCM/NBS — AdvFin" };

export default function PaginaClassificacao() {
  return (
    <>
      <div className="palco-cabeca">
        <div>
          <h1>
            Classificação NCM/NBS. <em>O regime e o fundamento.</em>
          </h1>
          <p>
            Busque pelo código (o prefixo mais específico vence) ou pela descrição. Leve o regime encontrado para o comparador na
            aba Cálculo.
          </p>
        </div>
      </div>
      <Classificacao />
    </>
  );
}
