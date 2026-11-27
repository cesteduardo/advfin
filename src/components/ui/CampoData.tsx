"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Balao } from "./Balao";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** AAAA-MM-DD sem fuso: a data é só um dia do calendário, nunca um instante. */
const iso = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const partes = (s: string) => s.split("-").map(Number) as [number, number, number];
const br = (s: string) => s.split("-").reverse().join("/");
const hojeIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
function somarDias(s: string, n: number) {
  const [a, m, d] = partes(s);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return iso(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

/**
 * Campo de data com calendário próprio, no lugar do calendário do navegador. O calendário sai
 * de baixo do botão. Solto (defaultValue + name) ou controlado (value + onChange).
 * Teclado no calendário: setas mudam o dia, PageUp/PageDown o mês, Enter escolhe, Esc fecha.
 */
export function CampoData({
  name,
  value,
  defaultValue,
  onChange,
  id,
  rotulo,
  min,
  max,
  vazio = false,
  compacto,
  placeholder = "dd/mm/aaaa",
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  id?: string;
  rotulo?: string;
  min?: string;
  max?: string;
  /** Permite apagar a data (filtros opcionais). */
  vazio?: boolean;
  compacto?: boolean;
  placeholder?: string;
}) {
  const [interno, setInterno] = useState(defaultValue ?? "");
  const atual = value ?? interno;
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(atual || hojeIso());
  const botao = useRef<HTMLButtonElement>(null);
  const oculto = useRef<HTMLInputElement>(null);
  const grade = useRef<HTMLDivElement>(null);
  const caixaId = useId();

  useEffect(() => {
    const form = oculto.current?.form;
    if (!form || value !== undefined) return;
    const restaurar = () => setInterno(defaultValue ?? "");
    form.addEventListener("reset", restaurar);
    return () => form.removeEventListener("reset", restaurar);
  }, [defaultValue, value]);

  const fora = (s: string) => Boolean((min && s < min) || (max && s > max));
  const fechar = useCallback(() => setAberto(false), []);
  const abrir = () => {
    setFoco(atual || (min && hojeIso() < min ? min : hojeIso()));
    setAberto(true);
  };
  const escolher = (s: string) => {
    if (fora(s)) return;
    if (value === undefined) setInterno(s);
    onChange?.(s);
    setAberto(false);
    botao.current?.focus();
  };

  // O dia em foco recebe o foco do teclado quando o calendário abre ou o dia muda.
  useEffect(() => {
    if (aberto) requestAnimationFrame(() => grade.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus());
  }, [aberto, foco]);

  const [fa, fm] = partes(foco);
  const primeiro = new Date(Date.UTC(fa, fm - 1, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(fa, fm, 0)).getUTCDate();
  const celulas: (string | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => iso(fa, fm - 1, i + 1))];
  const mudarMes = (n: number) => {
    const x = new Date(Date.UTC(fa, fm - 1 + n, 1));
    const ultimo = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
    setFoco(iso(x.getUTCFullYear(), x.getUTCMonth(), Math.min(partes(foco)[2], ultimo)));
  };

  const tecla = (e: KeyboardEvent) => {
    const passos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in passos) {
      e.preventDefault();
      setFoco(somarDias(foco, passos[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      mudarMes(e.key === "PageUp" ? -1 : 1);
    }
  };
  const hoje = hojeIso();

  return (
    <>
      {name && <input ref={oculto} type="hidden" name={name} value={atual} />}
      <button
        ref={botao}
        id={id}
        type="button"
        className={`seletor campo-data${compacto ? " seletor-compacto" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={rotulo ? `${rotulo}: ${atual ? br(atual) : "sem data"}` : undefined}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={(e) => {
          if (!aberto && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            abrir();
          }
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="campo-data-ico"><rect x="2" y="3" width="12" height="11" rx="2.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></svg>
        <span className={atual ? undefined : "seletor-vazio"}>{atual ? br(atual) : placeholder}</span>
      </button>
      <Balao ancora={botao} aberto={aberto} aoFechar={fechar} papel="dialog" id={caixaId} rotulo={rotulo ?? "Escolher data"} largura={292} classe="balao-calendario">
        <div className="cal-topo">
          <button type="button" className="cal-seta" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 4-4 4 4 4" /></svg>
          </button>
          <strong aria-live="polite">
            {MESES[fm - 1]} de {fa}
          </strong>
          <button type="button" className="cal-seta" onClick={() => mudarMes(1)} aria-label="Próximo mês">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
          </button>
        </div>
        <div className="cal-grade" role="grid" ref={grade} onKeyDown={tecla}>
          {SEMANA.map((d, i) => (
            <span key={i} className="cal-semana" aria-hidden="true">{d}</span>
          ))}
          {celulas.map((s, i) =>
            s ? (
              <button
                key={s}
                type="button"
                data-dia={s}
                className="cal-dia"
                tabIndex={s === foco ? 0 : -1}
                aria-label={`${SEMANA_LONGA[new Date(`${s}T12:00:00Z`).getUTCDay()]}, ${br(s)}`}
                aria-pressed={s === atual}
                aria-current={s === hoje ? "date" : undefined}
                disabled={fora(s)}
                onClick={() => escolher(s)}
              >
                {partes(s)[2]}
              </button>
            ) : (
              <span key={`v${i}`} />
            ),
          )}
        </div>
        <div className="cal-pe">
          <button type="button" onClick={() => escolher(hoje)} disabled={fora(hoje)}>Hoje</button>
          {vazio && atual && (
            <button
              type="button"
              onClick={() => {
                if (value === undefined) setInterno("");
                onChange?.("");
                setAberto(false);
              }}
            >
              Limpar
            </button>
          )}
          <span className="cal-dica">Setas mudam o dia · Esc fechar</span>
        </div>
      </Balao>
    </>
  );
}
