"use client";

import { useEffect } from "react";

/**
 * Reforço da escala das molduras: o CSS já calcula a escala com tan(atan2()),
 * mas alguns navegadores antigos não entendem essa conta. Aqui a escala é medida
 * de verdade e gravada em --s, que o CSS usa quando existe.
 */
export function EscalaAparelhos() {
  useEffect(() => {
    const caixas = Array.from(document.querySelectorAll<HTMLElement>(".aparelho[data-largura]"));
    if (!caixas.length) return;
    const medir = () =>
      caixas.forEach((c) => {
        const largura = Number(c.dataset.largura);
        if (largura && c.clientWidth) c.style.setProperty("--s", String(c.clientWidth / largura));
      });
    medir();
    const obs = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    caixas.forEach((c) => obs?.observe(c));
    addEventListener("resize", medir);
    return () => {
      obs?.disconnect();
      removeEventListener("resize", medir);
    };
  }, []);
  return null;
}
