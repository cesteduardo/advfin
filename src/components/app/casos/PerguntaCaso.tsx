"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icone } from "@/components/app/Icone";

/** Barra de pergunta do caso: abre a Pesquisa já no caso, com a pergunta enviada. */
export function PerguntaCaso({ caso }: { caso: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const ir = () => q.trim().length >= 2 && router.push(`/app/pesquisa?caso=${encodeURIComponent(caso)}&q=${encodeURIComponent(q.trim())}`);
  return (
    <form
      className="mesa-campo compositor caso-pergunta"
      onSubmit={(e) => {
        e.preventDefault();
        ir();
      }}
    >
      <label htmlFor="caso-q" className="so-leitor">Pergunte sobre este caso</label>
      <textarea
        id="caso-q"
        rows={1}
        maxLength={2000}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Pergunte sobre este caso…"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            ir();
          }
        }}
      />
      <button className="app-enviar compositor-enviar" data-vazio={q.trim() ? undefined : ""} aria-label="Pesquisar neste caso" title="Pesquisar neste caso (Enter)">
        <Icone nome="enviar" />
      </button>
    </form>
  );
}
