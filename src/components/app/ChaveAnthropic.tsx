"use client";

import { useEffect, useState } from "react";
import {
  MODELOS_GROQ,
  MODELOS_LAB,
  MODELOS_OPENROUTER,
  NOME_PROVEDOR,
  provedorDaChave,
  testarChave,
  type ProvedorNavegador,
} from "@/lib/pesquisa/laboratorio";
import { Seletor } from "@/components/ui/Seletor";

export type ProvedorChave = ProvedorNavegador;
const GUARDA: Record<ProvedorChave, string> = { anthropic: "advfin-lab-chave", groq: "advfin-lab-chave-groq", openrouter: "advfin-lab-chave-openrouter" };
const MODELOS: Record<ProvedorChave, readonly { id: string; nome: string; entrada: number; saida: number }[]> = {
  anthropic: MODELOS_LAB,
  groq: MODELOS_GROQ,
  openrouter: MODELOS_OPENROUTER,
};

/**
 * Chave da Anthropic do próprio desenvolvedor, para o laboratório e a demonstração estáticos.
 * Vive na memória da aba; vai para o localStorage só se ele salvar. Laboratório e demonstração
 * compartilham a mesma chave guardada.
 */
export function useChaveAnthropic() {
  return useChave("anthropic");
}

type Teste = { estado: "testando" } | { estado: "ok" | "erro"; mensagem: string } | null;

export function useChave(provedor: ProvedorChave) {
  const [chave, setChave] = useState("");
  const [lembrar, setLembrar] = useState(false);
  const [modelo, setModelo] = useState<string>(MODELOS[provedor][0].id);
  const [teste, setTeste] = useState<Teste>(null);
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

  const gravar = (sim: boolean, valor: string) => {
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
    teste,
    setModelo,
    setChave: (v: string) => {
      setChave(v);
      setTeste(null);
      if (lembrar) gravar(!!v.trim(), v.trim());
    },
    /** Salva neste navegador e confere a chave com o fornecedor. */
    salvar: async () => {
      const v = chave.trim();
      setTeste({ estado: "testando" });
      const r = await testarChave(provedor, v);
      if (r.ok) gravar(true, v);
      setTeste({ estado: r.ok ? "ok" : "erro", mensagem: r.ok ? `${r.mensagem} Guardada neste navegador.` : r.mensagem });
    },
    esquecer: () => {
      gravar(false, "");
      setChave("");
      setTeste(null);
    },
  };
}

export type EstadoChave = ReturnType<typeof useChave>;

const TEXTO: Record<ProvedorChave, { rotulo: string; dica: string; destino: string }> = {
  anthropic: { rotulo: "Chave da API da Anthropic", dica: "sk-ant-…", destino: "a Anthropic" },
  groq: { rotulo: "Chave grátis do Groq", dica: "gsk_…", destino: "o Groq" },
  openrouter: { rotulo: "Chave grátis do OpenRouter", dica: "sk-or-…", destino: "o OpenRouter" },
};

/** Campos da chave: colar, escolher o modelo, salvar e ver na hora se a chave funciona. */
export function CamposChave({ c, trocar }: { c: EstadoChave; trocar?: (p: ProvedorChave) => void }) {
  const t = TEXTO[c.provedor];
  const dona = provedorDaChave(c.chave);
  const outra = dona && dona !== c.provedor ? dona : null;
  const testando = c.teste?.estado === "testando";
  const [aberto, setAberto] = useState(false);
  // Chave salva e sem erro: uma linha só, para não tomar o rodapé do chat.
  if (c.lembrar && c.teste?.estado !== "erro" && !aberto) {
    return (
      <div className="lab-chave-resumo">
        <span className="lab-chave-status ok">✓ {NOME_PROVEDOR[c.provedor]} conectado · {MODELOS[c.provedor].find((m) => m.id === c.modelo)?.nome ?? c.modelo}</span>
        <button type="button" className="lab-chave-link" onClick={() => setAberto(true)}>
          Trocar chave ou modelo
        </button>
      </div>
    );
  }
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void c.salvar();
            }
          }}
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
                ? `Grátis no ${NOME_PROVEDOR[c.provedor]}, com limite diário de uso`
                : `US$ ${m.entrada.toLocaleString("pt-BR")} / ${m.saida.toLocaleString("pt-BR")} por milhão de tokens`,
          }))}
        />
      </div>
      {outra && (
        <p className="alerta aviso lab-chave-aviso" role="status">
          Essa chave é do {NOME_PROVEDOR[outra]}, não do {NOME_PROVEDOR[c.provedor]}.
          {trocar && (
            <>
              {" "}
              <button type="button" className="lab-chave-link" onClick={() => trocar(outra)}>
                Usar com o {NOME_PROVEDOR[outra]}
              </button>
            </>
          )}
        </p>
      )}
      <div className="lab-chave-pe">
        <button type="button" className="mesa-botao" disabled={!c.chave.trim() || testando} onClick={() => void c.salvar()}>
          {testando ? "Testando a chave…" : "Salvar e testar"}
        </button>
        {aberto && c.lembrar && (
          <button type="button" className="mesa-botao secundario" onClick={() => setAberto(false)}>
            Pronto
          </button>
        )}
        {c.lembrar && (
          <button
            type="button"
            className="mesa-botao secundario"
            onClick={() => {
              c.esquecer();
              setAberto(false);
            }}
          >
            Esquecer a chave
          </button>
        )}
        {c.teste && c.teste.estado !== "testando" && (
          <p className={`lab-chave-status ${c.teste.estado}`} role={c.teste.estado === "erro" ? "alert" : "status"}>
            {c.teste.estado === "ok" ? "✓ " : ""}
            {c.teste.mensagem}
          </p>
        )}
        {!c.teste && c.lembrar && <p className="lab-chave-status">Chave guardada neste navegador.</p>}
      </div>
      <p className="mesa-nota lab-chave-nota">
        Sem salvar, a chave vale só até fechar a aba. Ela vai direto deste navegador para {t.destino}; nenhum servidor do AdvFin a recebe.
      </p>
    </div>
  );
}
