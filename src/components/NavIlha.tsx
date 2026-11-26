"use client";

import { useEffect, useRef, useState } from "react";
import { usePilula } from "./Segmentado";

const LINKS = [
  { href: "#calculadora", nome: "Calculadora IBS/CBS" },
  { href: "#como-funciona", nome: "Como funciona" },
  { href: "#planos", nome: "Planos" },
  { href: "#lista", nome: "Programa fundador" },
];

/** Links da ilha com uma pílula que corre até a seção em leitura (ou até o link sob o ponteiro). */
export function NavIlha() {
  const trilha = useRef<HTMLElement>(null);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [mira, setMira] = useState<string | null>(null);
  const atual = mira ?? ativo;
  usePilula(trilha, atual);

  useEffect(() => {
    const secoes = LINKS.map((l) => document.querySelector(l.href)).filter(Boolean) as Element[];
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visivel) setAtivo(`#${visivel.target.id}`);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5] },
    );
    secoes.forEach((s) => obs.observe(s));
    const topo = () => window.scrollY < 200 && setAtivo(null);
    window.addEventListener("scroll", topo, { passive: true });
    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", topo);
    };
  }, []);

  return (
    <nav ref={trilha} className="nav-links segmentado-trilha nav-trilha" aria-label="Principal" onMouseLeave={() => setMira(null)}>
      <span className="segmentado-pilula" aria-hidden="true" />
      {LINKS.map((l) => (
        <a
          key={l.href}
          href={l.href}
          aria-current={l.href === atual ? "true" : undefined}
          onMouseEnter={() => setMira(l.href)}
          onFocus={() => setMira(l.href)}
          onBlur={() => setMira(null)}
        >
          {l.nome}
        </a>
      ))}
    </nav>
  );
}
