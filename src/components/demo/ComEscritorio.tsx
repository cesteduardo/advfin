"use client";

import { Cabeca } from "@/components/app/Cabeca";
import { Calculo } from "@/components/app/Calculo";
import { useDemo } from "./estado";

/** Nome do escritório que a pessoa criou na demonstração, para a trilha das telas. */
function useNomeEscritorio() {
  return useDemo()?.escritorio.nome ?? "Escritório";
}

export function CabecaDemo({ secao, titulo, descricao }: { secao: string; titulo: string; descricao?: string }) {
  return <Cabeca trilha={`${useNomeEscritorio()} / ${secao}`} titulo={titulo} descricao={descricao} />;
}

export function CalculoDemo() {
  return <Calculo trilha={`${useNomeEscritorio()} / Calculadora`} />;
}
