"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

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
 * Quando alguém clica, ela corre até o link como a gota do iPiscinas (mola e esticada);
 * ao rolar, muda de lugar sem correr.
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
  useGota(trilha, ativo, deslizar);

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
      <nav ref={trilha} className="nav-links segmentado-trilha nav-trilha" aria-label="Principal">
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

/**
 * A pílula como a gota de vidro do iPiscinas: mola subamortecida (chega, passa um tico e assenta)
 * e esticada na horizontal conforme a velocidade. Só corre quando `correr` vem do clique; pela
 * rolagem, no primeiro desenho, ao mudar o tamanho da tela ou com movimento reduzido, salta.
 */
function useGota(trilha: RefObject<HTMLElement | null>, ativo: string | null, correr: boolean) {
  const est = useRef({ x: 0, w: 0, vx: 0, vw: 0, tx: 0, tw: 0, quadro: 0, ultimo: 0, visivel: false });
  const remedir = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const t = trilha.current;
    if (!t) return;
    const e = est.current;
    const pintar = () => {
      const v = Math.min(Math.abs(e.vx) / 2600, 0.22);
      t.style.setProperty("--px", `${e.x.toFixed(2)}px`);
      t.style.setProperty("--pw", `${Math.max(0, e.w).toFixed(2)}px`);
      t.style.setProperty("--sx", (1 + v).toFixed(4));
      t.style.setProperty("--sy", (1 - v * 0.55).toFixed(4));
    };
    const passo = (agora: number) => {
      const dt = Math.min((agora - (e.ultimo || agora)) / 1000, 1 / 30);
      e.ultimo = agora;
      const k = 260, c = 24;
      e.vx += (k * (e.tx - e.x) - c * e.vx) * dt;
      e.vw += (k * (e.tw - e.w) - c * e.vw) * dt;
      e.x += e.vx * dt;
      e.w += e.vw * dt;
      pintar();
      if (Math.abs(e.tx - e.x) < 0.3 && Math.abs(e.vx) < 4 && Math.abs(e.tw - e.w) < 0.3) {
        e.x = e.tx; e.w = e.tw; e.vx = e.vw = 0; e.quadro = 0; e.ultimo = 0;
        pintar();
        return;
      }
      e.quadro = requestAnimationFrame(passo);
    };
    const ir = (saltar: boolean) => {
      const a = ativo ? t.querySelector<HTMLElement>(`a[href="${ativo}"]`) : null;
      t.toggleAttribute("data-sem-pilula", !a);
      if (!a) { e.visivel = false; return; }
      t.style.setProperty("--py", `${a.offsetTop}px`);
      t.style.setProperty("--ph", `${a.offsetHeight}px`);
      e.tx = a.offsetLeft;
      e.tw = a.offsetWidth;
      const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (saltar || calmo || !e.visivel) {
        // Primeira aparição nasce no lugar, sem viajar desde a borda.
        cancelAnimationFrame(e.quadro);
        e.quadro = 0; e.ultimo = 0;
        e.x = e.tx; e.w = e.tw; e.vx = e.vw = 0;
        e.visivel = true;
        pintar();
        return;
      }
      if (!e.quadro) e.quadro = requestAnimationFrame(passo);
    };
    // O link ativo fica em peso 500 e muda a largura da trilha: com a gota correndo, a medida
    // nova só corrige o destino; parada, ela salta para o lugar certo.
    remedir.current = () => ir(!e.quadro);
    ir(!correr);
  }, [trilha, ativo, correr]);

  // Tela que muda de tamanho ou fonte que termina de carregar: a pílula salta para a medida nova.
  // Criados uma vez só: um observador novo a cada troca dispararia na hora e cortaria a mola.
  useEffect(() => {
    const t = trilha.current;
    let primeira = true;
    const obs = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => (primeira ? (primeira = false) : remedir.current()));
    if (t) obs?.observe(t);
    document.fonts?.ready.then(() => remedir.current()).catch(() => {});
    return () => {
      obs?.disconnect();
      cancelAnimationFrame(est.current.quadro);
    };
  }, [trilha]);
}
