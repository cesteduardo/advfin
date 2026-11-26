"use client";

import { useEffect } from "react";

/**
 * Entrada suave dos blocos ao rolar a página.
 * Só esconde o que ainda está abaixo da dobra no momento em que a página abre,
 * então nada pisca no carregamento; sem JavaScript, ou com movimento reduzido, tudo aparece normal.
 */
const ALVOS = ".secao-cabeca, .tres > div, .planos-periodo, .plano, .calc, .faq-item, .faq-palco, .espera, footer .envoltorio > *";

export function Revelar() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(ALVOS)).filter(
      (el) => el.getBoundingClientRect().top > innerHeight * 0.92,
    );
    els.forEach((el) => {
      const irmaos = el.parentElement ? Array.from(el.parentElement.children).filter((c) => els.includes(c as HTMLElement)) : [];
      el.style.setProperty("--atraso", `${Math.min(irmaos.indexOf(el), 6) * 70}ms`);
      el.classList.add("a-revelar");
    });
    const obs = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("visivel");
          obs.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return null;
}
