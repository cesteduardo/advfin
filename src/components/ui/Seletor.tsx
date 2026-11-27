"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Balao } from "./Balao";

export interface OpcaoSeletor {
  valor: string;
  rotulo: string;
  descricao?: string;
  desativada?: boolean;
}

/**
 * Seletor no estilo do site, no lugar do <select> do navegador. A lista sai de baixo do botão.
 * Funciona solto (defaultValue + name, para formulários do servidor) ou controlado (value + onChange).
 * Teclado: setas, Home/End, Enter/Espaço, Esc e digitar a primeira letra.
 */
export function Seletor({
  opcoes,
  name,
  value,
  defaultValue,
  onChange,
  id,
  rotulo,
  placeholder = "Escolha",
  disabled,
  classe = "",
  compacto,
}: {
  opcoes: readonly OpcaoSeletor[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  id?: string;
  /** Nome acessível quando não há <label htmlFor>. */
  rotulo?: string;
  placeholder?: string;
  disabled?: boolean;
  classe?: string;
  /** Versão pílula pequena (barra da pesquisa). */
  compacto?: boolean;
}) {
  const [interno, setInterno] = useState(defaultValue ?? "");
  const atual = value ?? interno;
  const [aberto, setAberto] = useState(false);
  const [ativa, setAtiva] = useState(0);
  const botao = useRef<HTMLButtonElement>(null);
  const oculto = useRef<HTMLInputElement>(null);
  const lista = useId();
  const sel = opcoes.find((o) => o.valor === atual);

  // Formulário do servidor: depois de enviar, o React restaura os campos; o seletor volta junto.
  useEffect(() => {
    const form = oculto.current?.form;
    if (!form || value !== undefined) return;
    const restaurar = () => setInterno(defaultValue ?? "");
    form.addEventListener("reset", restaurar);
    return () => form.removeEventListener("reset", restaurar);
  }, [defaultValue, value]);

  // Com o teclado, a opção ativa fica sempre à vista dentro da lista.
  useEffect(() => {
    if (aberto) document.getElementById(`${lista}-${ativa}`)?.scrollIntoView({ block: "nearest" });
  }, [aberto, ativa, lista]);

  const escolher = (v: string) => {
    if (value === undefined) setInterno(v);
    onChange?.(v);
    setAberto(false);
    botao.current?.focus();
  };
  const fechar = useCallback(() => setAberto(false), []);
  const abrir = () => {
    setAtiva(Math.max(0, opcoes.findIndex((o) => o.valor === atual)));
    setAberto(true);
  };
  const mover = (de: number, passo: number) => {
    let i = de;
    for (let n = 0; n < opcoes.length; n++) {
      i = (i + passo + opcoes.length) % opcoes.length;
      if (!opcoes[i].desativada) return i;
    }
    return de;
  };

  const tecla = (e: KeyboardEvent) => {
    if (disabled) return;
    const k = e.key;
    if (!aberto) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(k)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      setAtiva((i) => mover(i, k === "ArrowDown" ? 1 : -1));
    } else if (k === "Home" || k === "End") {
      e.preventDefault();
      setAtiva(k === "Home" ? mover(-1, 1) : mover(opcoes.length, -1));
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      const o = opcoes[ativa];
      if (o && !o.desativada) escolher(o.valor);
    } else if (k === "Tab") {
      setAberto(false);
    } else if (k.length === 1 && /\S/.test(k)) {
      const i = opcoes.findIndex((o, j) => j > ativa && o.rotulo.toLowerCase().startsWith(k.toLowerCase()));
      const j = i >= 0 ? i : opcoes.findIndex((o) => o.rotulo.toLowerCase().startsWith(k.toLowerCase()));
      if (j >= 0) setAtiva(j);
    }
  };

  return (
    <>
      {name && <input ref={oculto} type="hidden" name={name} value={atual} />}
      <button
        ref={botao}
        id={id}
        type="button"
        className={`seletor${compacto ? " seletor-compacto" : ""} ${classe}`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? lista : undefined}
        aria-label={rotulo ? `${rotulo}: ${sel?.rotulo ?? placeholder}` : undefined}
        aria-activedescendant={aberto ? `${lista}-${ativa}` : undefined}
        disabled={disabled}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={tecla}
      >
        <span className={sel ? undefined : "seletor-vazio"}>{sel?.rotulo ?? placeholder}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      <Balao ancora={botao} aberto={aberto} aoFechar={fechar} papel="listbox" id={lista} rotulo={rotulo} classe="balao-lista">
        {opcoes.map((o, i) => (
          <div
            key={o.valor}
            id={`${lista}-${i}`}
            role="option"
            aria-selected={o.valor === atual}
            aria-disabled={o.desativada || undefined}
            data-ativa={i === ativa ? "" : undefined}
            className="balao-opcao"
            onPointerEnter={() => setAtiva(i)}
            onClick={() => !o.desativada && escolher(o.valor)}
          >
            <span>
              {o.rotulo}
              {o.descricao && <small>{o.descricao}</small>}
            </span>
            {o.valor === atual && (
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" /></svg>
            )}
          </div>
        ))}
      </Balao>
    </>
  );
}
