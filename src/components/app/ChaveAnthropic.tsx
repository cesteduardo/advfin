"use client";

import { useEffect, useState } from "react";
import { MODELOS_LAB } from "@/lib/pesquisa/laboratorio";
import { Seletor } from "@/components/ui/Seletor";

const GUARDA = "advfin-lab-chave";

/**
 * Chave da Anthropic do próprio desenvolvedor, para o laboratório e a demonstração estáticos.
 * Vive na memória da aba; vai para o localStorage só se ele pedir. Laboratório e demonstração
 * compartilham a mesma chave guardada.
 */
export function useChaveAnthropic() {
  const [chave, setChave] = useState("");
  const [lembrar, setLembrar] = useState(false);
  const [modelo, setModelo] = useState<string>(MODELOS_LAB[0].id);

  useEffect(() => {
    try {
      const g = localStorage.getItem(GUARDA);
      if (g) {
        setChave(g);
        setLembrar(true);
      }
    } catch {
      /* sem armazenamento: segue só na memória */
    }
  }, []);

  const guardar = (sim: boolean, valor: string) => {
    setLembrar(sim);
    try {
      if (sim && valor) localStorage.setItem(GUARDA, valor);
      else localStorage.removeItem(GUARDA);
    } catch {
      /* navegador sem armazenamento: a chave fica só na memória da aba */
    }
  };

  return {
    chave,
    modelo,
    lembrar,
    setModelo,
    setChave: (v: string) => {
      setChave(v);
      if (lembrar) guardar(true, v);
    },
    setLembrar: (sim: boolean) => guardar(sim, chave),
  };
}

export type EstadoChave = ReturnType<typeof useChaveAnthropic>;

export function CamposChave({ c }: { c: EstadoChave }) {
  return (
    <div className="lab-chave">
      <div className="campo">
        <label htmlFor="lab-chave-input">Chave da API da Anthropic</label>
        <input
          id="lab-chave-input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={c.chave}
          onChange={(e) => c.setChave(e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="lab-modelo">Modelo</label>
        <Seletor
          id="lab-modelo"
          value={c.modelo}
          onChange={c.setModelo}
          opcoes={MODELOS_LAB.map((m) => ({
            valor: m.id,
            rotulo: m.nome,
            descricao: `US$ ${m.entrada.toLocaleString("pt-BR")} / ${m.saida.toLocaleString("pt-BR")} por milhão de tokens`,
          }))}
        />
      </div>
      <label className="caixa-aceite">
        <input type="checkbox" checked={c.lembrar} onChange={(e) => c.setLembrar(e.target.checked)} />
        <span>
          Lembrar a chave neste navegador. Sem marcar, ela some ao fechar a aba. A chave só vai para a Anthropic; nenhum servidor
          do AdvFin a recebe.
        </span>
      </label>
    </div>
  );
}
