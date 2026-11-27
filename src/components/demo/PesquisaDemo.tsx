"use client";

import { useEffect, useState } from "react";
import { Segmentado } from "@/components/Segmentado";
import { CamposChave, useChaveAnthropic } from "@/components/app/ChaveAnthropic";
import { PesquisaMesa } from "@/components/app/PesquisaMesa";
import { rodarLab } from "@/lib/pesquisa/laboratorio";
import { agora, alterar, novoId, useDemo } from "./estado";

const STATUS: Record<string, string> = { respondida: "Respondida", bloqueada_citacao: "Bloqueada pelo verificador", sem_resultado: "Sem dispositivos", erro: "Erro" };

type Modo = "extrativo" | "anthropic";
const MODOS: { id: Modo; nome: string }[] = [
  { id: "extrativo", nome: "Sem IA" },
  { id: "anthropic", nome: "Claude (minha chave)" },
];

/** Pesquisa da demonstração: mesma mesa do app, com a resposta montada no navegador. */
export function PesquisaDemo() {
  const [modo, setModo] = useState<Modo>("extrativo");
  const c = useChaveAnthropic();

  const e = useDemo();
  // O caso vem pelo endereço (?caso=...) quando a pessoa clica em "Pesquisar neste caso".
  const [casoInicial, setCasoInicial] = useState<string | undefined>(undefined);
  useEffect(() => setCasoInicial(new URLSearchParams(location.search).get("caso") ?? undefined), []);

  const executar = async (pergunta: string, data: string, caso?: string | null) => {
    if (modo === "anthropic" && !c.chave.trim()) {
      return { status: "invalida" as const, mensagem: "Cole sua chave da Anthropic no quadro acima, ou volte ao modo sem IA." };
    }
    const desfecho = (await rodarLab({ pergunta, data, modo, chave: c.chave.trim(), modelo: c.modelo })).desfecho;
    {
      alterar(
        (x) => ({ ...x, consultas: [{ id: novoId(), pergunta, data, caso: caso ?? null, status: STATUS[desfecho.status] ?? desfecho.status, criadoEm: agora() }, ...x.consultas].slice(0, 200) }),
        "consulta",
        pergunta.slice(0, 120),
      );
    }
    return desfecho;
  };
  const vigencia = e && e.perfil.vigencia !== "hoje" ? e.perfil.vigencia : undefined;

  return (
    <>
      <div className="mesa-cartao lab-config demo-origem" role="group" aria-labelledby="demo-modo">
        <div className="demo-origem-linha">
          <p className="mesa-rotulo" id="demo-modo">Quem redige a resposta</p>
          <Segmentado rotulo="Quem redige a resposta" idRotulo="demo-modo" opcoes={MODOS} valor={modo} muda={(v) => setModo(v as Modo)} />
        </div>
        <p className="mesa-nota">
          {modo === "extrativo"
            ? "Sem IA, a resposta traz os dispositivos mais relevantes, literalmente. Com o Claude, ele redige a partir deles, e o verificador confere cada citação antes de mostrar."
            : "O Claude é chamado direto deste navegador, com a sua chave. O custo sai da sua conta, e cada pergunta custa centavos."}
        </p>
        {modo === "anthropic" && <CamposChave c={c} />}
      </div>
      <PesquisaMesa
        key={casoInicial ?? "sem-caso"}
        executar={executar}
        falhaRede="Não foi possível montar a resposta neste navegador."
        dataInicial={vigencia}
        casos={e?.casos.map((x) => ({ id: x.id, titulo: x.titulo }))}
        casoInicial={casoInicial && e?.casos.some((x) => x.id === casoInicial) ? casoInicial : ""}
      />
    </>
  );
}
