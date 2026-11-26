"use client";

import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";

/**
 * Controle segmentado: uma pílula desliza até a opção escolhida.
 * Quando as opções não cabem, a trilha rola por dentro e a escolhida fica sempre à vista.
 * Teclado: setas, Home e End trocam a escolha; só a opção ativa recebe Tab.
 */

const ATIVO = '[aria-checked="true"], [aria-current="true"], [aria-current="page"]';

/** Mede o item ativo da trilha e posiciona a pílula sobre ele. */
export function usePilula(trilha: RefObject<HTMLElement | null>, chave: unknown) {
  const primeira = useRef(true);
  useLayoutEffect(() => {
    const t = trilha.current;
    if (!t) return;
    const medir = () => {
      const a = t.querySelector<HTMLElement>(ATIVO);
      t.toggleAttribute("data-sem-pilula", !a);
      if (!a) return;
      t.style.setProperty("--px", `${a.offsetLeft}px`);
      t.style.setProperty("--pw", `${a.offsetWidth}px`);
      t.style.setProperty("--ph", `${a.offsetHeight}px`);
      t.style.setProperty("--py", `${a.offsetTop}px`);
    };
    // Bordas esmaecidas só do lado que ainda tem opções escondidas.
    const bordas = () => {
      const resto = t.scrollWidth - t.clientWidth - t.scrollLeft;
      t.toggleAttribute("data-esmaece-inicio", t.scrollLeft > 1);
      t.toggleAttribute("data-esmaece-fim", resto > 1);
    };
    t.addEventListener("scroll", bordas, { passive: true });
    medir();
    // Na primeira medida a pílula já nasce no lugar; daí em diante, desliza.
    if (primeira.current) requestAnimationFrame(() => t.setAttribute("data-pronta", ""));

    const a = t.querySelector<HTMLElement>(ATIVO);
    if (a && t.scrollWidth > t.clientWidth) {
      const folga = 20;
      const ini = a.offsetLeft - folga;
      const fim = a.offsetLeft + a.offsetWidth + folga - t.clientWidth;
      const alvo = t.scrollLeft > ini ? ini : t.scrollLeft < fim ? fim : t.scrollLeft;
      const calmo = primeira.current || matchMedia("(prefers-reduced-motion: reduce)").matches;
      t.scrollTo({ left: Math.max(0, alvo), behavior: calmo ? "auto" : "smooth" });
    }
    primeira.current = false;

    bordas();
    const obs = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => (medir(), bordas()));
    obs?.observe(t);
    document.fonts?.ready.then(medir).catch(() => {});
    return () => {
      obs?.disconnect();
      t.removeEventListener("scroll", bordas);
    };
  }, [trilha, chave]);
}

export interface Opcao<T extends string | number> {
  id: T;
  nome: ReactNode;
}

export function Segmentado<T extends string | number>({
  rotulo,
  opcoes,
  valor,
  muda,
  cheio,
  tom,
  idRotulo,
}: {
  rotulo: string;
  opcoes: readonly Opcao<T>[];
  valor: T;
  muda: (v: T) => void;
  /** Ocupa a largura toda, com opções do mesmo tamanho. */
  cheio?: boolean;
  /** "escuro" para usar sobre o marinho. */
  tom?: "escuro";
  /** id de um rótulo visível que nomeia o grupo. */
  idRotulo?: string;
}) {
  const trilha = useRef<HTMLDivElement>(null);
  usePilula(trilha, valor);
  const atual = Math.max(0, opcoes.findIndex((o) => o.id === valor));

  const tecla = (e: KeyboardEvent<HTMLButtonElement>) => {
    const ultimo = opcoes.length - 1;
    const k = e.key;
    const alvo =
      k === "ArrowRight" || k === "ArrowDown"
        ? atual === ultimo ? 0 : atual + 1
        : k === "ArrowLeft" || k === "ArrowUp"
          ? atual === 0 ? ultimo : atual - 1
          : k === "Home" ? 0 : k === "End" ? ultimo : -1;
    if (alvo < 0) return;
    e.preventDefault();
    muda(opcoes[alvo].id);
    requestAnimationFrame(() => trilha.current?.querySelectorAll<HTMLButtonElement>("button")[alvo]?.focus());
  };

  return (
    <div className={`segmentado${cheio ? " segmentado-cheio" : ""}${tom ? ` segmentado-${tom}` : ""}`}>
      <div
        ref={trilha}
        className="segmentado-trilha"
        role="radiogroup"
        aria-label={idRotulo ? undefined : rotulo}
        aria-labelledby={idRotulo}
      >
        <span className="segmentado-pilula" aria-hidden="true" />
        {opcoes.map((o) => {
          const sel = o.id === valor;
          return (
            <button
              key={String(o.id)}
              type="button"
              role="radio"
              aria-checked={sel}
              tabIndex={sel ? 0 : -1}
              onClick={() => muda(o.id)}
              onKeyDown={tecla}
            >
              {o.nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}
