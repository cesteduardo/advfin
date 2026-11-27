"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
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
 * o ícone escolhido dá um pequeno salto. A dock fica fixa: não se recolhe ao rolar, para a
 * tela não mudar de tamanho nem piscar.
 */
export function Dock({ links }: { links: ItemDock[] }) {
  const trilha = useRef<HTMLElement>(null);
  const caminho = usePathname();
  const [toque, setToque] = useState<{ href: string; em: string } | null>(null);

  // O toque vale até a rota mudar; depois, quem manda é o endereço.
  const tocado = toque && toque.em === caminho ? toque.href : null;
  const atual = tocado ?? links.find((l) => ativoEm(caminho, l.href))?.href ?? null;
  usePilula(trilha, atual);

  return (
    <nav
      ref={trilha}
      className="app-abas mesa-abas dock"
      aria-label="Ferramentas"
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
