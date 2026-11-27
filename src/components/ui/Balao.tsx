"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Balão ancorado: tudo o que um botão abre (lista de um seletor, calendário, dica) nasce
 * escondido atrás da borda de baixo do botão e desliza para fora, abaixo dele. Só vira para
 * cima quando não cabe até o pé da janela. Nada de janela padrão do navegador.
 *
 * Vai para o body (portal) para não ser cortado por cartões com overflow, e acompanha o
 * botão na rolagem e no redimensionamento.
 */
export function Balao({
  ancora,
  aberto,
  aoFechar,
  children,
  largura = "ancora",
  classe = "",
  papel,
  id,
  rotulo,
  interativo = true,
}: {
  ancora: RefObject<HTMLElement | null>;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  /** "ancora": mesma largura do botão (mínimo); um número fixa a largura em px. */
  largura?: "ancora" | number;
  classe?: string;
  papel?: string;
  id?: string;
  rotulo?: string;
  /** Dicas não recebem clique nem fecham por clique fora. */
  interativo?: boolean;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; w: number; lado: "baixo" | "cima" } | null>(null);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  useLayoutEffect(() => {
    if (!aberto) {
      setPos(null);
      return;
    }
    const medir = () => {
      const a = ancora.current;
      const b = caixa.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const w = largura === "ancora" ? r.width : largura;
      const h = b?.offsetHeight ?? 0;
      const folga = 8;
      const cabeEmbaixo = r.bottom + folga + h <= window.innerHeight - 8;
      const lado = cabeEmbaixo || r.top - folga - h < 8 ? "baixo" : "cima";
      const larguraReal = Math.max(w, b?.offsetWidth ?? 0);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - larguraReal - 8);
      setPos({ top: lado === "baixo" ? r.bottom + folga : r.top - folga - h, left, w, lado });
    };
    medir();
    // Segunda medida: a altura real do balão só existe depois do primeiro desenho.
    const q = requestAnimationFrame(medir);
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(q);
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [aberto, ancora, largura]);

  useEffect(() => {
    if (!aberto || !interativo) return;
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (caixa.current?.contains(alvo) || ancora.current?.contains(alvo)) return;
      aoFechar();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      aoFechar();
      ancora.current?.focus();
    };
    document.addEventListener("pointerdown", fora, true);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("pointerdown", fora, true);
      document.removeEventListener("keydown", esc, true);
    };
  }, [aberto, interativo, aoFechar, ancora]);

  if (!montado || !aberto) return null;
  return createPortal(
    <div
      ref={caixa}
      id={id}
      role={papel}
      aria-label={rotulo}
      className={`balao ${classe}`}
      data-lado={pos?.lado ?? "baixo"}
      data-pronto={pos ? "" : undefined}
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        minWidth: largura === "ancora" ? pos?.w : undefined,
        width: typeof largura === "number" ? largura : undefined,
        pointerEvents: interativo ? undefined : "none",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
