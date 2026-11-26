import type { ReactNode } from "react";

/** Topo da área principal, como na demonstração: trilha, título e, à direita, as pílulas. */
export function Cabeca({ trilha, titulo, children, descricao }: { trilha: string; titulo: string; descricao?: string; children?: ReactNode }) {
  return (
    <header className="mesa-topo">
      <div>
        <p className="mesa-trilha">{trilha}</p>
        <h1>{titulo}</h1>
        {descricao && <p className="mesa-descricao">{descricao}</p>}
      </div>
      {children}
    </header>
  );
}
