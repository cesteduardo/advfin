import { Fragment, type CSSProperties } from "react";

/**
 * Quebra um texto em palavras para a entrada escalonada do título.
 * O texto continua inteiro para leitores de tela (aria-label no título);
 * as palavras animadas ficam escondidas deles.
 */
export function Palavras({ texto, inicio = 0 }: { texto: string; inicio?: number }) {
  const palavras = texto.split(" ");
  return (
    <>
      {palavras.map((p, i) => (
        <Fragment key={i}>
          <span className="palavra" style={{ "--i": inicio + i } as CSSProperties} aria-hidden="true">
            {p}
          </span>
          {i < palavras.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </>
  );
}
