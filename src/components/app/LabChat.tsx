"use client";

import { useEffect, useState } from "react";
import { Segmentado } from "@/components/Segmentado";
import { MODELOS_LAB, rodarLab, type ModoLab } from "@/lib/pesquisa/laboratorio";
import { BASE_LOCAL } from "@/lib/pesquisa/base-local";
import { Icone } from "./Icone";
import { RodadaView, hoje, type Rodada } from "./RodadaDev";

const GUARDA = "advfin-lab-chave";

const MODOS: { id: ModoLab; nome: string }[] = [
  { id: "extrativo", nome: "Sem IA" },
  { id: "simulado-inventado", nome: "Citação inventada" },
  { id: "anthropic", nome: "Claude (minha chave)" },
];

const lerGuardada = () => {
  try {
    return localStorage.getItem(GUARDA) ?? "";
  } catch {
    return "";
  }
};

/**
 * Laboratório estático do chat: recuperação, modelo e verificador rodam no navegador.
 * A chave só vive na memória da aba; fica no navegador apenas se o desenvolvedor pedir.
 */
export function LabChat() {
  const [modo, setModo] = useState<ModoLab>("extrativo");
  const [chave, setChave] = useState("");
  const [lembrar, setLembrar] = useState(false);
  const [modelo, setModelo] = useState<string>(MODELOS_LAB[0].id);
  const [pergunta, setPergunta] = useState("");
  const [data, setData] = useState(hoje);
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [pendente, setPendente] = useState(false);

  useEffect(() => {
    const g = lerGuardada();
    if (g) {
      setChave(g);
      setLembrar(true);
    }
  }, []);

  const guardar = (sim: boolean, valor = chave) => {
    setLembrar(sim);
    try {
      if (sim && valor) localStorage.setItem(GUARDA, valor);
      else localStorage.removeItem(GUARDA);
    } catch {
      /* navegador sem armazenamento: a chave fica só na memória da aba */
    }
  };

  const semChave = modo === "anthropic" && !chave.trim();
  const podeEnviar = !pendente && pergunta.trim().length >= 8 && !semChave;

  const enviar = async () => {
    const q = pergunta.trim();
    if (!podeEnviar) return;
    setPergunta("");
    setPendente(true);
    let r: Rodada["r"];
    try {
      r = await rodarLab({ pergunta: q, data, modo, chave: chave.trim(), modelo });
    } catch (e) {
      r = { erro: (e as Error).message };
    }
    setRodadas((x) => [{ pergunta: q, data, r }, ...x]);
    setPendente(false);
  };

  return (
    <div className="dev">
      <p className="alerta aviso">
        Página de teste do desenvolvedor, fora do índice de buscadores. A base tem só {BASE_LOCAL.length} dispositivos da EC 132 e
        da LC 214, transcritos sem conferência. Nada aqui é registrado nem serve para parecer.
      </p>

      <div className="mesa-cartao lab-config" role="group" aria-labelledby="lab-modo">
        <p className="mesa-rotulo" id="lab-modo">Origem da resposta</p>
        <Segmentado rotulo="Origem da resposta" idRotulo="lab-modo" opcoes={MODOS} valor={modo} muda={(v) => setModo(v as ModoLab)} />
        <p className="mesa-nota">
          {modo === "extrativo" && "Devolve os trechos mais relevantes, literalmente, sem redação. Não gasta nada."}
          {modo === "simulado-inventado" &&
            "Imita um modelo que inventa um dispositivo e uma citação. Serve para ver o verificador bloquear a resposta."}
          {modo === "anthropic" &&
            "Chama a API da Anthropic direto deste navegador, com a sua chave. O custo sai da sua conta, e cada pergunta custa centavos."}
        </p>

        {modo === "anthropic" && (
          <div className="lab-chave">
            <div className="campo">
              <label htmlFor="lab-chave-input">Chave da API da Anthropic</label>
              <input
                id="lab-chave-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-ant-…"
                value={chave}
                onChange={(e) => {
                  setChave(e.target.value);
                  if (lembrar) guardar(true, e.target.value);
                }}
              />
            </div>
            <div className="campo">
              <label htmlFor="lab-modelo">Modelo</label>
              <select id="lab-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)}>
                {MODELOS_LAB.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} (US$ {m.entrada.toLocaleString("pt-BR")} / {m.saida.toLocaleString("pt-BR")} por milhão de tokens)
                  </option>
                ))}
              </select>
            </div>
            <label className="caixa-aceite">
              <input type="checkbox" checked={lembrar} onChange={(e) => guardar(e.target.checked)} />
              <span>
                Lembrar a chave neste navegador. Sem marcar, ela some ao fechar a aba. A chave só vai para a Anthropic; nenhum
                servidor do AdvFin a recebe.
              </span>
            </label>
          </div>
        )}
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
          placeholder="Ex.: Qual a alíquota da CBS e do IBS em 2026?"
        />
        <div className="mesa-campo-pe">
          <label className="app-data">
            Vigência em
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <button className="app-enviar" disabled={!podeEnviar} aria-label="Enviar">
            <Icone nome="enviar" />
          </button>
        </div>
      </form>
      {semChave && <p className="mesa-nota">Cole a chave acima para enviar.</p>}

      {pendente && <p className="mesa-carregando">Rodando recuperação, modelo e verificador…</p>}
      {rodadas.map((r, i) => (
        <RodadaView key={rodadas.length - i} rodada={r} />
      ))}
    </div>
  );
}
