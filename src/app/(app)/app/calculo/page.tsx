import { Calculo } from "@/components/app/Calculo";

export const metadata = { title: "Cálculo — AdvFin" };

export default function PaginaCalculo() {
  return (
    <>
      <div className="palco-cabeca">
        <div>
          <h1>
            Cálculo da transição. <em>Feito por código, não por IA.</em>
          </h1>
          <p>
            Motor determinístico com aritmética exata em centavos. Cada número mostra se vem de norma, estimativa ou premissa, e
            se o curador já conferiu.
          </p>
        </div>
      </div>
      <Calculo />
    </>
  );
}
