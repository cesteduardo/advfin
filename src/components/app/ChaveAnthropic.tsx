"use client";

import { useEffect, useState } from "react";
import { MODELOS_GROQ, MODELOS_LAB } from "@/lib/pesquisa/laboratorio";
import { Seletor } from "@/components/ui/Seletor";

export type ProvedorChave = "anthropic" | "groq";
const GUARDA: Record<ProvedorChave, string> = { anthropic: "advfin-lab-chave", groq: "advfin-lab-chave-groq" };
const MODELOS: Record<ProvedorChave, readonly { id: string; nome: string; entrada: number; saida: number }[]> = { anthropic: MODELOS_LAB, groq: MODELOS_GROQ };

/** Chave do Groq guardada neste navegador (para a transcrição de voz fora do Chrome). */
export function chaveGroqGuardada(): string {
  try {
    return localStorage.getItem(GUARDA.groq) ?? "";
  } catch {
    return "";
  }
}

/**
 * Chave da Anthropic do próprio desenvolvedor, para o laboratório e a demonstração estáticos.
 * Vive na memória da aba; vai para o localStorage só se ele pedir. Laboratório e demonstração
 * compartilham a mesma chave guardada.
 */
export function useChaveAnthropic() {
  return useChave("anthropic");
}

export function useChave(provedor: ProvedorChave) {
  const [chave, setChave] = useState("");
  const [lembrar, setLembrar] = useState(false);
  const [modelo, setModelo] = useState<string>(MODELOS[provedor][0].id);
  const guarda = GUARDA[provedor];

  useEffect(() => {
    try {
      const g = localStorage.getItem(guarda);
      if (g) {
        setChave(g);
        setLembrar(true);
      }
    } catch {
      /* sem armazenamento: segue só na memória */
    }
  }, [guarda]);

  const guardar = (sim: boolean, valor: string) => {
    setLembrar(sim);
    try {
      if (sim && valor) localStorage.setItem(guarda, valor);
      else localStorage.removeItem(guarda);
    } catch {
      /* navegador sem armazenamento: a chave fica só na memória da aba */
    }
  };

  return {
    provedor,
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

export type EstadoChave = ReturnType<typeof useChave>;

const TEXTO: Record<ProvedorChave, { rotulo: string; dica: string; destino: string }> = {
  anthropic: { rotulo: "Chave da API da Anthropic", dica: "sk-ant-…", destino: "a Anthropic" },
  groq: { rotulo: "Chave grátis do Groq", dica: "gsk_…", destino: "o Groq" },
};

export function CamposChave({ c }: { c: EstadoChave }) {
  const t = TEXTO[c.provedor];
  return (
    <div className="lab-chave">
      <div className="campo">
        <label htmlFor="lab-chave-input">{t.rotulo}</label>
        <input
          id="lab-chave-input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={t.dica}
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
          opcoes={MODELOS[c.provedor].map((m) => ({
            valor: m.id,
            rotulo: m.nome,
            descricao:
              m.entrada === 0
                ? "Grátis no plano gratuito do Groq, com limite diário de uso"
                : `US$ ${m.entrada.toLocaleString("pt-BR")} / ${m.saida.toLocaleString("pt-BR")} por milhão de tokens`,
          }))}
        />
      </div>
      <label className="caixa-aceite">
        <input type="checkbox" checked={c.lembrar} onChange={(e) => c.setLembrar(e.target.checked)} />
        <span>
          Lembrar a chave neste navegador. Sem marcar, ela some ao fechar a aba. A chave só vai para {t.destino}; nenhum
          servidor do AdvFin a recebe.
        </span>
      </label>
    </div>
  );
}
