"use client";

import { useEffect, useState } from "react";
import { Seletor } from "@/components/ui/Seletor";
import { CamposChave, useChaveAnthropic } from "@/components/app/ChaveAnthropic";
import { PesquisaMesa } from "@/components/app/PesquisaMesa";
import { rodarLab } from "@/lib/pesquisa/laboratorio";
import { agora, alterar, euDe, novoId, useDemo } from "./estado";

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
  const eu = e ? euDe(e) : null;
  // O caso vem pelo endereço (?caso=...) quando a pessoa clica em "Pesquisar neste caso".
  const [casoInicial, setCasoInicial] = useState<string | undefined>(undefined);
  useEffect(() => setCasoInicial(new URLSearchParams(location.search).get("caso") ?? undefined), []);

  const executar = async (pergunta: string, data: string, caso?: string | null) => {
    if (modo === "anthropic" && !c.chave.trim()) {
      return { status: "invalida" as const, mensagem: "Cole sua chave da Anthropic no quadro abaixo do campo, ou volte ao modo sem IA." };
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
      <PesquisaMesa
        key={casoInicial ?? "sem-caso"}
        executar={executar}
        falhaRede="Não foi possível montar a resposta neste navegador."
        dataInicial={vigencia}
        casos={e?.casos.map((x) => ({ id: x.id, titulo: x.titulo }))}
        casoInicial={casoInicial && e?.casos.some((x) => x.id === casoInicial) ? casoInicial : ""}
        nome={eu?.nome.split(" ")[0]}
        opcoesCampo={
          <span className="app-data">
            <span className="app-data-rotulo">Resposta</span>
            <Seletor value={modo} onChange={(v) => setModo(v as Modo)} rotulo="Quem redige a resposta" compacto opcoes={MODOS.map((m) => ({ valor: m.id, rotulo: m.nome }))} />
          </span>
        }
        abaixoDoCampo={
          modo === "anthropic" ? (
            <div className="mesa-cartao lab-config demo-origem mesa-entra">
              <p className="mesa-nota">O Claude é chamado direto deste navegador, com a sua chave. O custo sai da sua conta, e cada pergunta custa centavos.</p>
              <CamposChave c={c} />
            </div>
          ) : null
        }
      />
    </>
  );
}
