"use client";

import { useState, useTransition } from "react";
import { acaoPesquisarDev } from "@/lib/pesquisa/acao";
import { Icone } from "./Icone";
import { RodadaView, hoje, type Rodada } from "./RodadaDev";

export function DevChat({ provedor, redige }: { provedor: string; redige: boolean }) {
  const [pergunta, setPergunta] = useState("");
  const [data, setData] = useState(hoje);
  const [extrativo, setExtrativo] = useState(!redige);
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [pendente, iniciar] = useTransition();

  const enviar = () => {
    const q = pergunta.trim();
    if (q.length < 8) return;
    setPergunta("");
    iniciar(async () => {
      let r: Rodada["r"];
      try {
        r = await acaoPesquisarDev(q, data, extrativo);
      } catch (e) {
        r = { erro: (e as Error).message };
      }
      setRodadas((x) => [{ pergunta: q, data, r }, ...x]);
    });
  };

  return (
    <div className="dev">
      <div className="mesa-auditoria">
        <p className="mesa-rotulo">Configuração do servidor</p>
        <ul>
          <li>
            <i className={redige ? "ok" : ""} />
            Provedor ativo: <b>{provedor}</b>
            <span>{redige ? "redige" : "sem chave: só extrativo"}</span>
          </li>
          <li>
            <i className="ok" />
            Cada teste passa pelo mesmo verificador e fica registrado em consultas e auditoria
          </li>
        </ul>
      </div>

      <form
        className="mesa-campo"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <label htmlFor="dev-pergunta" className="so-leitor">Pergunta de teste</label>
        <textarea
          id="dev-pergunta"
          rows={2}
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder="Pergunta de teste para o chat da IA…"
        />
        <div className="mesa-campo-pe">
          <div className="dev-opcoes">
            <label className="app-data">
              Vigência em
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label className="app-data dev-chave">
              <input type="checkbox" checked={extrativo} disabled={!redige} onChange={(e) => setExtrativo(e.target.checked)} />
              Forçar modo extrativo
            </label>
          </div>
          <button className="app-enviar" disabled={pendente || pergunta.trim().length < 8} aria-label="Enviar">
            <Icone nome="enviar" />
          </button>
        </div>
      </form>

      {pendente && <p className="mesa-carregando">Rodando recuperação, modelo e verificador…</p>}
      {rodadas.map((r, i) => (
        <RodadaView key={rodadas.length - i} rodada={r} />
      ))}
    </div>
  );
}
