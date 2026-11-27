"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePilula } from "@/components/Segmentado";
import { Icone, type NomeIcone } from "./Icone";

export interface ItemDock {
  href: string;
  curto: string;
  icone: NomeIcone;
}

/** Compara sem a barra final, que a versão estática acrescenta aos endereços. */
export const ativoEm = (caminho: string, href: string) => {
  const c = caminho.replace(/\/+$/, "") || "/";
  return href === "/app" ? c === "/app" : c.startsWith(href);
};

/**
 * Dock de vidro do celular.
 * A pílula marinho desliza até a aba tocada no instante do toque, antes de a página chegar;
 * o ícone escolhido dá um pequeno salto. Ao rolar para baixo a dock se recolhe e encolhe,
 * para dar a tela ao texto; ao rolar para cima, ou ao chegar ao fim da página, ela volta.
 */
export function Dock({ links }: { links: ItemDock[] }) {
  const trilha = useRef<HTMLElement>(null);
  const caminho = usePathname();
  const [toque, setToque] = useState<{ href: string; em: string } | null>(null);
  const [recolhida, setRecolhida] = useState(false);

  // O toque vale até a rota mudar; depois, quem manda é o endereço.
  const tocado = toque && toque.em === caminho ? toque.href : null;
  const atual = tocado ?? links.find((l) => ativoEm(caminho, l.href))?.href ?? null;
  usePilula(trilha, atual);

  useEffect(() => {
    let antes = window.scrollY;
    let quadro = 0;
    let acumulado = 0;
    const ler = () => {
      quadro = 0;
      const y = window.scrollY;
      const dy = y - antes;
      antes = y;
      // Soma a rolagem na mesma direção, para um tremor do dedo não esconder a dock.
      acumulado = Math.sign(dy) === Math.sign(acumulado) ? acumulado + dy : dy;
      const fim = y + window.innerHeight >= document.documentElement.scrollHeight - 24;
      if (y < 80 || fim || acumulado < -24) setRecolhida(false);
      else if (acumulado > 36) setRecolhida(true);
    };
    const rolar = () => {
      if (!quadro) quadro = requestAnimationFrame(ler);
    };
    window.addEventListener("scroll", rolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", rolar);
      cancelAnimationFrame(quadro);
    };
  }, []);

  // Trocar de página traz a dock de volta.
  useEffect(() => setRecolhida(false), [caminho]);

  return (
    <nav
      ref={trilha}
      className="app-abas mesa-abas dock"
      aria-label="Ferramentas"
      data-recolhida={recolhida ? "" : undefined}
      onFocus={() => setRecolhida(false)}
    >
      <span className="segmentado-pilula dock-pilula" aria-hidden="true" />
      {links.map((l) => {
        const eh = l.href === atual;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={eh ? "ativo" : undefined}
            aria-current={eh ? "page" : undefined}
            onClick={() => setToque({ href: l.href, em: caminho })}
          >
            <span className="dock-ico" key={eh ? "sim" : "nao"}>
              <Icone nome={l.icone} />
            </span>
            {l.curto}
          </Link>
        );
      })}
    </nav>
  );
}
