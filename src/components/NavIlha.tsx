"use client";

import { useEffect, useRef, useState } from "react";
import { usePilula } from "./Segmentado";

const LINKS = [
  { href: "#calculadora", nome: "Calculadora IBS/CBS" },
  { href: "#como-funciona", nome: "Como funciona" },
  { href: "#planos", nome: "Planos" },
];
const SECOES = [...LINKS.map((l) => l.href), "#lista"];

/**
 * Navegação da ilha.
 * Desktop: links com uma pílula que corre até a seção em leitura (ou até o link sob o ponteiro).
 * Celular: botão de menu que abre uma gaveta por baixo da ilha.
 */
export function NavIlha() {
  const trilha = useRef<HTMLElement>(null);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [mira, setMira] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const atual = mira ?? ativo;
  usePilula(trilha, atual);

  useEffect(() => {
    const secoes = SECOES.map((h) => document.querySelector(h)).filter(Boolean) as Element[];
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

  // A gaveta fecha com Esc e quando a tela volta a ser larga.
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    const mq = matchMedia("(min-width: 1001px)");
    const largo = () => mq.matches && setAberto(false);
    document.addEventListener("keydown", esc);
    mq.addEventListener("change", largo);
    document.documentElement.classList.add("menu-aberto");
    return () => {
      document.removeEventListener("keydown", esc);
      mq.removeEventListener("change", largo);
      document.documentElement.classList.remove("menu-aberto");
    };
  }, [aberto]);

  return (
    <>
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

      <div className="acoes-topo">
        <a href="#lista" className="botao peq">
          Lista de espera
        </a>
        <button
          type="button"
          className="menu-btn"
          aria-expanded={aberto}
          aria-controls="gaveta"
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          onClick={() => setAberto((v) => !v)}
        >
          <span aria-hidden="true" />
        </button>
      </div>

      <div className="veu" aria-hidden="true" onClick={() => setAberto(false)} />
      <nav id="gaveta" className="gaveta" aria-label="Menu" inert={!aberto}>
        {[...LINKS, { href: "#lista", nome: "Programa fundador" }].map((l) => (
          <a key={l.href} href={l.href} aria-current={l.href === ativo ? "true" : undefined} onClick={() => setAberto(false)}>
            {l.nome}
          </a>
        ))}
        <a href="#lista" className="botao" onClick={() => setAberto(false)}>
          Entrar na lista de espera
        </a>
      </nav>
    </>
  );
}
