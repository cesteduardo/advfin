"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
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

type Transicao = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };
type DocVT = Document & { startViewTransition?: (f: () => void) => Transicao };

/**
 * Troca de tema feita pela pessoa: o novo tema se revela num círculo que nasce do botão
 * clicado, numa só imagem (nada muda antes do resto). Sem View Transitions, as cores
 * atravessam juntas; com movimento reduzido, troca na hora.
 */
function trocarSuave(mudar: () => void, origem?: { x: number; y: number }) {
  const doc = document as DocVT;
  const h = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return mudar();
  if (!doc.startViewTransition) {
    h.classList.add("tema-trocando");
    mudar();
    window.setTimeout(() => h.classList.remove("tema-trocando"), 420);
    return;
  }
  const x = origem?.x ?? innerWidth / 2;
  const y = origem?.y ?? innerHeight / 2;
  const raio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  h.classList.add("vt-tema");
  const vt = doc.startViewTransition(() => flushSync(mudar));
  vt.ready
    .then(() => {
      h.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`] },
        { duration: 560, easing: "cubic-bezier(.65, 0, .35, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {});
  vt.finished.finally(() => h.classList.remove("vt-tema")).catch(() => {});
  vt.updateCallbackDone.catch(() => {});
}

function aplicar(p: Preferencia) {
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
  const escolher = (p: Preferencia, e?: React.MouseEvent<HTMLButtonElement>) => {
    try {
      if (p === "sistema") localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, p);
    } catch {}
    const r = e?.currentTarget.getBoundingClientRect();
    trocarSuave(
      () => {
        setPref(p);
        aplicar(p);
      },
      r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined,
    );
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
        <button key={o.p} type="button" aria-pressed={pref === o.p} aria-label={o.rotulo} title={o.rotulo} onClick={(e) => escolher(o.p, e)}>
          <Icone nome={o.icone} />
        </button>
      ))}
    </span>
  );
}
