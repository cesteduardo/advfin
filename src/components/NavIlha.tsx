"use client";

import { useEffect, useRef, useState } from "react";
import { usePilula } from "./Segmentado";

/** Na mesma ordem das seções na página: a pílula anda junto com a rolagem. */
const LINKS = [
  { href: "#como-funciona", nome: "Como funciona" },
  { href: "#calculadora", nome: "Calculadora IBS/CBS" },
  { href: "#planos", nome: "Planos" },
  { href: "#perguntas", nome: "Perguntas" },
];
const SECOES = [...LINKS.map((l) => l.href), "#lista"];

/**
 * Navegação da ilha.
 * Desktop: a pílula marca só a seção em leitura, conforme a rolagem (passar o mouse não a move).
 * Ela desliza até o link apenas quando alguém clica; ao rolar, muda de lugar sem correr.
 * Celular: botão de menu que abre uma gaveta por baixo da ilha.
 */
export function NavIlha() {
  const trilha = useRef<HTMLElement>(null);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [deslizar, setDeslizar] = useState(false);
  const [aberto, setAberto] = useState(false);
  // Depois de um clique, a rolagem suave passa por outras seções no caminho; até ela parar,
  // a pílula fica no destino em vez de piscar nas seções intermediárias.
  const travada = useRef(false);
  usePilula(trilha, ativo);

  useEffect(() => {
    const secoes = SECOES.map((h) => document.querySelector(h)).filter(Boolean) as Element[];
    const pelaRolagem = (h: string | null) => {
      if (travada.current) return;
      setDeslizar(false);
      setAtivo(h);
    };
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visivel) pelaRolagem(`#${visivel.target.id}`);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5] },
    );
    secoes.forEach((s) => obs.observe(s));
    const topo = () => window.scrollY < 200 && pelaRolagem(null);
    window.addEventListener("scroll", topo, { passive: true });
    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", topo);
    };
  }, []);

  const clicar = (href: string) => {
    setDeslizar(true);
    setAtivo(href);
    travada.current = true;
    let fim = 0;
    const soltar = () => {
      window.clearTimeout(fim);
      window.removeEventListener("scrollend", soltar);
      travada.current = false;
    };
    window.addEventListener("scrollend", soltar, { once: true });
    fim = window.setTimeout(soltar, 1500); // navegadores sem scrollend
  };

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
      <nav ref={trilha} className="nav-links segmentado-trilha nav-trilha" aria-label="Principal" data-desliza={deslizar ? "" : undefined}>
        <span className="segmentado-pilula" aria-hidden="true" />
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} aria-current={l.href === ativo ? "true" : undefined} onClick={() => clicar(l.href)}>
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
