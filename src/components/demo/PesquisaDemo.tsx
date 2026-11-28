"use client";

import { useEffect, useState } from "react";
import { Seletor } from "@/components/ui/Seletor";
import { CamposChave, useChave } from "@/components/app/ChaveAnthropic";
import { PesquisaMesa } from "@/components/app/PesquisaMesa";
import { rodarLab } from "@/lib/pesquisa/laboratorio";
import type { DocumentoAnexo, TurnoAnterior } from "@/lib/pesquisa/geracao";
import { agora, alterar, euDe, novoId, useDemo } from "./estado";

const STATUS: Record<string, string> = { respondida: "Respondida", bloqueada_citacao: "Bloqueada pelo verificador", sem_resultado: "Sem dispositivos", erro: "Erro" };

type Modo = "extrativo" | "anthropic" | "groq" | "openrouter";
const MODOS: { id: Modo; nome: string }[] = [
  { id: "extrativo", nome: "Sem IA" },
  { id: "openrouter", nome: "Grátis · OpenRouter (minha chave)" },
  { id: "anthropic", nome: "Claude (minha chave)" },
  { id: "groq", nome: "Groq (só no app com servidor)" },
];

/** Pesquisa da demonstração: mesma mesa do app, com a resposta montada no navegador. */
export function PesquisaDemo() {
  const [modo, setModo] = useState<Modo>("extrativo");
  const claude = useChave("anthropic");
  const groq = useChave("groq");
  const livre = useChave("openrouter");
  const c = modo === "groq" ? groq : modo === "openrouter" ? livre : claude;
  // Com uma chave já salva, a resposta vem redigida pela IA desde o início.
  const [escolheu, setEscolheu] = useState(false);
  useEffect(() => {
    if (escolheu) return;
    if (livre.lembrar) setModo("openrouter");
    else if (claude.lembrar) setModo("anthropic");
  }, [escolheu, livre.lembrar, claude.lembrar]);

  const e = useDemo();
  const eu = e ? euDe(e) : null;
  // O caso vem pelo endereço (?caso=...) quando a pessoa clica em "Pesquisar neste caso".
  const [casoInicial, setCasoInicial] = useState<string | undefined>(undefined);
  useEffect(() => setCasoInicial(new URLSearchParams(location.search).get("caso") ?? undefined), []);

  const executar = async (pergunta: string, data: string, caso?: string | null, documentos: DocumentoAnexo[] = [], historico: TurnoAnterior[] = []) => {
    if (modo !== "extrativo" && !c.chave.trim()) {
      const quem = modo === "anthropic" ? "sua chave da Anthropic" : modo === "groq" ? "sua chave do Groq" : "sua chave grátis do OpenRouter";
      return { status: "invalida" as const, mensagem: `Cole ${quem} no quadro abaixo do campo, ou volte ao modo sem IA.` };
    }
    const desfecho = (await rodarLab({ pergunta, data, modo, chave: c.chave.trim(), modelo: c.modelo, documentos, historico })).desfecho;
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
        notaAnexos={modo === "extrativo" ? "Sem IA, o texto do anexo é lido mas não entra na resposta. Escolha um modelo em Resposta para ele ser considerado." : undefined}
        opcoesCampo={
          <span className="app-data">
            <span className="app-data-rotulo">Resposta</span>
            <Seletor value={modo} onChange={(v) => {
              setEscolheu(true);
              setModo(v as Modo);
            }} rotulo="Quem redige a resposta" compacto opcoes={MODOS.map((m) => ({ valor: m.id, rotulo: m.nome }))} />
          </span>
        }
        abaixoDoCampo={
          modo !== "extrativo" ? (
            <div className="mesa-cartao lab-config demo-origem mesa-entra" data-conectado={c.lembrar ? "" : undefined} key={modo}>
              {!c.lembrar && <p className="mesa-nota">
                {modo === "openrouter" ? (
                  <>
                    Para testar sem custo. O OpenRouter dá acesso grátis a modelos abertos e aceita chamadas direto deste navegador. Crie a sua
                    chave em{" "}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>, cole abaixo e toque em Salvar e testar.
                  </>
                ) : modo === "groq" ? (
                  "O Groq não aceita chamadas direto do navegador, e esta demonstração não tem servidor. A chave dele funciona no app publicado com servidor (LLM_PROVEDOR=groq). Aqui, use o OpenRouter."
                ) : (
                  "O Claude é chamado direto deste navegador, com a sua chave. O custo sai da sua conta, e cada pergunta custa centavos."
                )}
              </p>}
              <CamposChave c={c} trocar={(p) => {
                setEscolheu(true);
                setModo(p);
              }} />
            </div>
          ) : null
        }
      />
    </>
  );
}
