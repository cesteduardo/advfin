"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { usePilula } from "@/components/Segmentado";
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

/**
 * Menu de seções em forma de dock: as mesmas abas em pílula de antes, com ícone pequeno e nome
 * completo, levadas para uma barra flutuante no rodapé. A pílula marinho marca a seção aberta e
 * desliza até a escolhida; um realce claro corre sob o cursor de uma aba para a outra.
 * No celular fica acima da barra principal e se recolhe junto com ela ao rolar.
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
  usePilula(trilha, montada ? atual : null);

  // Realce de hover: mede a aba sob o cursor e leva o fundo claro até ela.
  const mirar = (el: HTMLElement) => {
    const t = trilha.current;
    if (!t) return;
    t.style.setProperty("--hx", `${el.offsetLeft}px`);
    t.style.setProperty("--hw", `${el.offsetWidth}px`);
    t.setAttribute("data-mira", "");
  };
  const soltar = () => trilha.current?.removeAttribute("data-mira");

  // Setas, Home e End andam pelas abas; numa dock de botões, também escolhem a seção.
  const tecla = (e: KeyboardEvent<HTMLElement>) => {
    const lista = [...(trilha.current?.querySelectorAll<HTMLElement>(".dock-sec-item") ?? [])];
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
    <nav className="dock-sec" aria-label={rotulo}>
      <div ref={trilha} className="dock-sec-trilha" onPointerLeave={soltar}>
        <span className="dock-sec-mira" aria-hidden="true" />
        <span className="segmentado-pilula dock-sec-pilula" aria-hidden="true" />
        {itens.map((it) => {
          const eh = it.id === atual;
          const conteudo = (
            <>
              <Icone nome={it.icone ?? ICONE_DA_SECAO[it.id] ?? "curadoria"} />
              {it.nome}
              {it.conta ? <span className="mesa-conta" aria-label={`${it.conta} pendente${it.conta > 1 ? "s" : ""}`}>{it.conta}</span> : null}
            </>
          );
          const props = {
            className: `dock-sec-item${eh ? " ativo" : ""}`,
            "aria-current": eh ? (base ? ("page" as const) : ("true" as const)) : undefined,
            onKeyDown: tecla,
            onPointerEnter: (e: PointerEvent<HTMLElement>) => e.pointerType === "mouse" && mirar(e.currentTarget),
            onFocus: (e: React.FocusEvent<HTMLElement>) => mirar(e.currentTarget),
            onBlur: soltar,
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
