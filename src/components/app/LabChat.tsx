"use client";

import { useState } from "react";
import { Segmentado } from "@/components/Segmentado";
import { rodarLab, type ModoLab } from "@/lib/pesquisa/laboratorio";
import { BASE_LOCAL } from "@/lib/pesquisa/base-local";
import { CamposChave, useChave } from "./ChaveAnthropic";
import { Icone } from "./Icone";
import { RodadaView, hoje, type Rodada } from "./RodadaDev";
import { CampoData } from "@/components/ui/CampoData";

const MODOS: { id: ModoLab; nome: string }[] = [
  { id: "extrativo", nome: "Sem IA" },
  { id: "simulado-inventado", nome: "Citação inventada" },
  { id: "anthropic", nome: "Claude (minha chave)" },
  { id: "groq", nome: "Groq grátis" },
];

/**
 * Laboratório estático do chat: recuperação, modelo e verificador rodam no navegador.
 * A chave só vive na memória da aba; fica no navegador apenas se o desenvolvedor pedir.
 */
export function LabChat() {
  const [modo, setModo] = useState<ModoLab>("extrativo");
  const claude = useChave("anthropic");
  const groq = useChave("groq");
  const c = modo === "groq" ? groq : claude;
  const [pergunta, setPergunta] = useState("");
  const [data, setData] = useState(hoje);
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [pendente, setPendente] = useState(false);

  const semChave = (modo === "anthropic" || modo === "groq") && !c.chave.trim();
  const podeEnviar = !pendente && pergunta.trim().length >= 8 && !semChave;

  const enviar = async () => {
    const q = pergunta.trim();
    if (!podeEnviar) return;
    setPergunta("");
    setPendente(true);
    let r: Rodada["r"];
    try {
      r = await rodarLab({ pergunta: q, data, modo, chave: c.chave.trim(), modelo: c.modelo });
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
          {modo === "groq" &&
            "Chama o Groq direto deste navegador, com a sua chave grátis (console.groq.com/keys). Modelos abertos, sem custo, com limite diário."}
        </p>

        {(modo === "anthropic" || modo === "groq") && <CamposChave key={modo} c={c} />}
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
          <span className="app-data">
            Vigência em
            <CampoData value={data} onChange={setData} min="2023-12-21" rotulo="Vigência em" compacto />
          </span>
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
