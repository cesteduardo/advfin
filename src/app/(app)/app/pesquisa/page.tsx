import { Pesquisa } from "@/components/app/Pesquisa";

export const metadata = { title: "Pesquisa — AdvFin" };

export default function PaginaPesquisa() {
  return (
    <>
      <div className="palco-cabeca">
        <div>
          <h1>
            Pesquisa fundamentada. <em>A fonte antes da prosa.</em>
          </h1>
          <p>
            A resposta só usa dispositivos vigentes na data escolhida. Cada marca numerada abre o trecho original ao lado. Se
            alguma citação não existir na base, a resposta é bloqueada.
          </p>
        </div>
      </div>
      <Pesquisa />
    </>
  );
}
