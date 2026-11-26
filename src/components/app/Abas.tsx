"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePilula } from "@/components/Segmentado";

/**
 * Abas em pílula, no mesmo desenho do controle segmentado da calculadora, mas cada aba é um
 * endereço (?aba=...): dá para voltar, recarregar e mandar o link de uma aba.
 */
export function Abas({ base, abas, atual, rotulo }: { base: string; abas: { id: string; nome: string; conta?: number }[]; atual: string; rotulo: string }) {
  const trilha = useRef<HTMLElement>(null);
  usePilula(trilha, atual);
  return (
    <div className="segmentado mesa-abas-pilula">
      <nav ref={trilha} className="segmentado-trilha" aria-label={rotulo}>
        <span className="segmentado-pilula" aria-hidden="true" />
        {abas.map((a) => (
          <Link key={a.id} href={`${base}?aba=${a.id}`} aria-current={a.id === atual ? "page" : undefined} scroll={false} replace>
            {a.nome}
            {a.conta ? <span className="mesa-conta">{a.conta}</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
