"use client";

import { useId, useState, useTransition } from "react";

export const MOTIVOS_RELATO = [
  ["texto_diferente", "O texto não confere com o oficial"],
  ["dispositivo_errado", "Artigo, parágrafo ou inciso errado"],
  ["fora_de_vigencia", "Revogado ou fora de vigência na data"],
  ["nao_sustenta", "O trecho não sustenta a afirmação"],
  ["outro", "Outro problema"],
] as const;

export type Motivo = (typeof MOTIVOS_RELATO)[number][0];
export type EnviarRelato = (r: { dispositivo: string; trecho: string; motivo: Motivo; comentario: string }) => Promise<
  { ok: true } | { ok: false; mensagem: string }
>;

/**
 * "Relatar citação errada", no pé de cada cartão de fonte. Vai para a fila do curador
 * com o dispositivo e o trecho; a pergunta do advogado não segue junto.
 */
export function RelatarCitacao({ dispositivo, trecho, enviar }: { dispositivo: string; trecho: string; enviar: EnviarRelato }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<Motivo | "">("");
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const id = useId();

  if (estado?.ok) {
    return (
      <p className="relato-feito" role="status">
        Relato enviado à curadoria. Obrigado: é assim que a base fica mais precisa.
      </p>
    );
  }

  if (!aberto) {
    return (
      <button type="button" className="relato-abrir" onClick={(e) => (e.stopPropagation(), setAberto(true))}>
        Relatar citação errada
      </button>
    );
  }

  return (
    <form
      className="relato"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        if (!motivo) return setEstado({ ok: false, texto: "Escolha o motivo." });
        iniciar(async () => {
          try {
            const r = await enviar({ dispositivo, trecho, motivo, comentario });
            setEstado(r.ok ? { ok: true, texto: "" } : { ok: false, texto: r.mensagem });
          } catch {
            setEstado({ ok: false, texto: "Não foi possível falar com o servidor." });
          }
        });
      }}
    >
      <fieldset>
        <legend>O que está errado nesta citação?</legend>
        {MOTIVOS_RELATO.map(([v, rotulo]) => (
          <label key={v}>
            <input type="radio" name={`motivo-${id}`} value={v} checked={motivo === v} onChange={() => setMotivo(v)} />
            {rotulo}
          </label>
        ))}
      </fieldset>
      <label className="relato-comentario">
        <span>Detalhe (opcional). Não inclua dados de clientes.</span>
        <textarea rows={2} maxLength={1000} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      </label>
      {estado && !estado.ok && (
        <p className="alerta erro" role="alert">
          {estado.texto}
        </p>
      )}
      <div className="relato-acoes">
        <button className="mesa-botao" disabled={pendente}>
          {pendente ? "Enviando…" : "Enviar à curadoria"}
        </button>
        <button type="button" className="mesa-botao secundario" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
