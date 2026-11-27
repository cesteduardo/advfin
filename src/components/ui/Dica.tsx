"use client";

import { useRef, useState, type ReactNode } from "react";
import { Balao } from "./Balao";

/**
 * Dica no estilo do site, no lugar do `title` do navegador: sai de baixo do elemento,
 * depois de um instante com o mouse parado em cima (ou no foco do teclado).
 */
export function Dica({ texto, children, classe }: { texto: string; children: ReactNode; classe?: string }) {
  const alvo = useRef<HTMLSpanElement>(null);
  const [aberta, setAberta] = useState(false);
  const espera = useRef<number>(0);
  const mostrar = () => {
    window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => setAberta(true), 450);
  };
  const esconder = () => {
    window.clearTimeout(espera.current);
    setAberta(false);
  };
  return (
    <span ref={alvo} className={classe} onPointerEnter={mostrar} onPointerLeave={esconder} onFocus={mostrar} onBlur={esconder}>
      {children}
      <Balao ancora={alvo} aberto={aberta} aoFechar={esconder} papel="tooltip" classe="balao-dica" interativo={false}>
        {texto}
      </Balao>
    </span>
  );
}
