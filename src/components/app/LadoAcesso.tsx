import { Marca } from "./Marca";

export function LadoAcesso() {
  return (
    <aside className="acesso-lado">
      <Marca claro />
      <h1>
        Cada resposta com a norma ao lado.
        <em>Cada norma com a data em que vale.</em>
      </h1>
      <blockquote>
        A IA prepara, o advogado decide. Citação que não existe na base é bloqueada antes de chegar à sua tela.
      </blockquote>
    </aside>
  );
}
