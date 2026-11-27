"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Icone, type NomeIcone } from "./Icone";

/** Ícone de cada seção, pelo id. Uma seção sem ícone próprio usa o genérico. */
const ICONE_DA_SECAO: Record<string, NomeIcone> = {
  dados: "perfil",
  seguranca: "seguranca",
  preferencias: "preferencias",
  escritorios: "predio",
  privacidade: "privacidade",
  demo: "baixar",
  pessoas: "escritorio",
  convidar: "convidar",
  convites: "convidar",
  configuracoes: "configuracoes",
  auditoria: "auditoria",
  consumo: "consumo",
  plano: "plano",
  tempo: "tempo",
  comparador: "comparador",
  apuracao: "apuracao",
  curadoria: "curadoria",
  oab: "selo",
  lgpd: "seguranca",
  equipe: "escritorio",
};

export interface ItemSecao<T extends string = string> {
  id: T;
  nome: string;
  conta?: number;
  icone?: NomeIcone;
}

/** Quanto o ícone cresce sob o cursor e até que distância o efeito chega, como na dock do macOS. */
const ZOOM = 0.42;
const ALCANCE = 120;

/**
 * Dock de seções no estilo do macOS: substitui as abas do topo das telas.
 * Desktop: flutua no rodapé da área de trabalho; os ícones crescem sob o cursor e o nome
 * aparece num balão. Celular: fica logo acima da dock principal, com o nome sob o ícone,
 * e se recolhe junto com ela ao rolar.
 * Com `base`, cada seção é um endereço (?aba=); sem ela, `muda` troca a seção na própria página.
 */
export function DockSecoes<T extends string>({
  rotulo,
  itens,
  atual,
  muda,
  base,
}: {
  rotulo: string;
  itens: readonly ItemSecao<T>[];
  atual: T;
  muda?: (id: T) => void;
  base?: string;
}) {
  const [montada, setMontada] = useState(false);
  const trilha = useRef<HTMLDivElement>(null);
  useEffect(() => setMontada(true), []);

  const lupa = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    trilha.current?.querySelectorAll<HTMLElement>(".dock-mac-item").forEach((el) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      const z = 1 + ZOOM * Math.max(0, Math.cos(Math.min(1, d / ALCANCE) * (Math.PI / 2)));
      el.style.setProperty("--z", z.toFixed(3));
    });
  };
  const soltar = () => trilha.current?.querySelectorAll<HTMLElement>(".dock-mac-item").forEach((el) => el.style.removeProperty("--z"));

  // Setas, Home e End andam pela dock; numa dock de botões, também escolhem a seção.
  const tecla = (e: KeyboardEvent<HTMLElement>) => {
    const lista = [...(trilha.current?.querySelectorAll<HTMLElement>(".dock-mac-item") ?? [])];
    const i = lista.indexOf(e.currentTarget);
    const k = e.key;
    const alvo = k === "ArrowRight" ? (i + 1) % lista.length : k === "ArrowLeft" ? (i - 1 + lista.length) % lista.length : k === "Home" ? 0 : k === "End" ? lista.length - 1 : -1;
    if (alvo < 0) return;
    e.preventDefault();
    lista[alvo].focus();
    if (!base) muda?.(itens[alvo].id);
  };

  if (!montada) return null;

  return createPortal(
    <nav className="dock-mac" aria-label={rotulo}>
      <div ref={trilha} className="dock-mac-trilha" onPointerMove={lupa} onPointerLeave={soltar}>
        {itens.map((it, n) => {
          const eh = it.id === atual;
          const conteudo = (
            <>
              <span className="dock-mac-tile">
                <Icone nome={it.icone ?? ICONE_DA_SECAO[it.id] ?? "curadoria"} />
                {it.conta ? <span className="dock-mac-conta" aria-label={`${it.conta} pendente${it.conta > 1 ? "s" : ""}`}>{it.conta}</span> : null}
              </span>
              <span className="dock-mac-nome">{it.nome}</span>
              <i className="dock-mac-ponto" aria-hidden="true" />
            </>
          );
          const props = {
            className: `dock-mac-item${eh ? " ativo" : ""}`,
            "aria-current": eh ? (base ? ("page" as const) : ("true" as const)) : undefined,
            onKeyDown: tecla,
            style: { "--n": n } as React.CSSProperties,
          };
          return base ? (
            <Link key={it.id} href={`${base}?aba=${it.id}`} scroll={false} replace {...props}>
              {conteudo}
            </Link>
          ) : (
            <button key={it.id} type="button" onClick={() => muda?.(it.id)} {...props}>
              {conteudo}
            </button>
          );
        })}
      </div>
    </nav>,
    document.body,
  );
}
