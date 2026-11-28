"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icone, type NomeIcone } from "./Icone";

/**
 * Tema do app: segue o sistema por padrão; a chave guarda "claro" ou "escuro" neste navegador.
 * O script roda antes da primeira pintura (sem piscar o claro no escuro); o efeito cobre a
 * navegação pelo cliente e tira o atributo ao sair do app, para a landing seguir clara.
 */
const CHAVE = "advfin-tema";
type Preferencia = "sistema" | "claro" | "escuro";

const SCRIPT = `(function(){try{var p=localStorage.getItem("${CHAVE}");var e=p==="escuro"||(p!=="claro"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.tema=e?"escuro":"claro"}catch(_){}})()`;

const sistemaEscuro = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

function ler(): Preferencia {
  try {
    const p = localStorage.getItem(CHAVE);
    return p === "claro" || p === "escuro" ? p : "sistema";
  } catch {
    return "sistema";
  }
}

/** Troca de tema feita pela pessoa: as cores atravessam em ~280 ms, sem piscar. */
function suavizar() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const h = document.documentElement;
  h.classList.add("tema-trocando");
  clearTimeout((window as unknown as { __temaT?: number }).__temaT);
  (window as unknown as { __temaT?: number }).__temaT = window.setTimeout(() => h.classList.remove("tema-trocando"), 340);
}

function aplicar(p: Preferencia, suave = false) {
  if (suave) suavizar();
  const escuro = p === "escuro" || (p === "sistema" && sistemaEscuro());
  document.documentElement.dataset.tema = escuro ? "escuro" : "claro";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#080b11" : "#0f2742");
  window.dispatchEvent(new Event("advfin-tema"));
}

/** Vai uma vez no layout do app. */
export function TemaApp() {
  useEffect(() => {
    aplicar(ler());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const mudou = () => ler() === "sistema" && aplicar("sistema");
    mq.addEventListener("change", mudou);
    return () => {
      mq.removeEventListener("change", mudou);
      delete document.documentElement.dataset.tema;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0f2742");
    };
  }, []);
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

const OPCOES: { p: Preferencia; icone: NomeIcone; rotulo: string }[] = [
  { p: "sistema", icone: "automatico", rotulo: "Seguir o sistema" },
  { p: "claro", icone: "sol", rotulo: "Modo claro" },
  { p: "escuro", icone: "lua", rotulo: "Modo escuro" },
];

/** Chave de três posições: sistema, claro, escuro. */
export function ChaveTema() {
  const [pref, setPref] = useState<Preferencia>("sistema");
  useEffect(() => setPref(ler()), []);
  const escolher = (p: Preferencia) => {
    setPref(p);
    try {
      if (p === "sistema") localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, p);
    } catch {}
    aplicar(p, true);
  };
  // A pílula desliza até a opção escolhida, como nas abas e na dock.
  const trilha = useRef<HTMLSpanElement>(null);
  const [pronta, setPronta] = useState(false);
  useLayoutEffect(() => {
    const t = trilha.current;
    const a = t?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!t || !a) return;
    t.style.setProperty("--px", `${a.offsetLeft}px`);
    t.style.setProperty("--pw", `${a.offsetWidth}px`);
    if (!pronta) requestAnimationFrame(() => setPronta(true));
  }, [pref, pronta]);
  return (
    <span className="tema-chave" role="group" aria-label="Tema" ref={trilha} data-pronta={pronta ? "" : undefined}>
      <span className="tema-pilula" aria-hidden="true" />
      {OPCOES.map((o) => (
        <button key={o.p} type="button" aria-pressed={pref === o.p} aria-label={o.rotulo} title={o.rotulo} onClick={() => escolher(o.p)}>
          <Icone nome={o.icone} />
        </button>
      ))}
    </span>
  );
}
