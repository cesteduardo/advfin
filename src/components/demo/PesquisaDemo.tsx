"use client";

import { useEffect, useRef, useState } from "react";
import { Seletor } from "@/components/ui/Seletor";
import { CamposChave, useChave } from "@/components/app/ChaveAnthropic";
import { PesquisaMesa, type TurnoSalvo } from "@/components/app/PesquisaMesa";
import { guardarConversa, lerConversa } from "./conversas";
import { rodarLab } from "@/lib/pesquisa/laboratorio";
import type { DocumentoAnexo, TurnoAnterior } from "@/lib/pesquisa/geracao";
import { agora, alterar, euDe, novoId, useDemo } from "./estado";

const STATUS: Record<string, string> = { respondida: "Respondida", conversa: "Conversa sem fonte", bloqueada_citacao: "Bloqueada pelo verificador", sem_resultado: "Sem dispositivos", erro: "Erro" };

type Modo = "extrativo" | "anthropic" | "groq" | "openrouter";
const MODOS: { id: Modo; nome: string }[] = [
  { id: "extrativo", nome: "Sem IA" },
  { id: "openrouter", nome: "Grátis · OpenRouter (minha chave)" },
  { id: "anthropic", nome: "Claude (minha chave)" },
  { id: "groq", nome: "Groq (só no app com servidor)" },
];

const GUARDA_MODO = "advfin-demo-resposta";

/** Pesquisa da demonstração: mesma mesa do app, com a resposta montada no navegador. */
export function PesquisaDemo() {
  const [modo, setModo] = useState<Modo>("extrativo");
  const claude = useChave("anthropic");
  const groq = useChave("groq");
  const livre = useChave("openrouter");
  const c = modo === "groq" ? groq : modo === "openrouter" ? livre : claude;
  // A escolha de quem responde fica guardada; sem escolha guardada, uma chave salva já liga a IA.
  const [escolheu, setEscolheu] = useState(false);
  useEffect(() => {
    try {
      const g = localStorage.getItem(GUARDA_MODO) as Modo | null;
      if (g && MODOS.some((m) => m.id === g)) {
        setModo(g);
        setEscolheu(true);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (escolheu) return;
    if (livre.lembrar) setModo("openrouter");
    else if (claude.lembrar) setModo("anthropic");
  }, [escolheu, livre.lembrar, claude.lembrar]);
  // Salvou e a chave passou no teste: este passa a ser o modo guardado.
  useEffect(() => {
    if (c.teste?.estado !== "ok") return;
    try {
      localStorage.setItem(GUARDA_MODO, modo);
    } catch {}
  }, [c.teste, modo]);
  const escolher = (m: Modo) => {
    setEscolheu(true);
    setModo(m);
    try {
      localStorage.setItem(GUARDA_MODO, m);
    } catch {}
  };

  const e = useDemo();
  const eu = e ? euDe(e) : null;
  // O caso vem pelo endereço (?caso=...) quando a pessoa clica em "Pesquisar neste caso".
  // Pela barra do caso vem também a pergunta (?q=...); por uma conversa salva, ?conversa=...
  const [casoInicial, setCasoInicial] = useState<string | undefined>(undefined);
  const [endereco, setEndereco] = useState<{ conversa: string; turnos?: TurnoSalvo[]; q?: string } | null>(null);
  useEffect(() => {
    const u = new URLSearchParams(location.search);
    const salva = u.get("conversa") ? lerConversa(u.get("conversa")!) : undefined;
    setCasoInicial(salva?.caso ?? u.get("caso") ?? undefined);
    setEndereco({ conversa: salva?.id ?? novoId(), turnos: salva?.turnos, q: salva ? undefined : (u.get("q") ?? undefined) });
  }, []);
  const casoDaConversa = useRef<string | null>(null);

  const executar = async (pergunta: string, data: string, caso?: string | null, documentos: DocumentoAnexo[] = [], historico: TurnoAnterior[] = []) => {
    if (modo !== "extrativo" && !c.chave.trim()) {
      const quem = modo === "anthropic" ? "sua chave da Anthropic" : modo === "groq" ? "sua chave do Groq" : "sua chave grátis do OpenRouter";
      return { status: "invalida" as const, mensagem: `Cole ${quem} no quadro abaixo do campo, ou volte ao modo sem IA.` };
    }
    casoDaConversa.current = caso ?? null;
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
      {endereco && <PesquisaMesa
        key={endereco.conversa}
        turnosIniciais={endereco.turnos}
        perguntaInicial={endereco.q}
        aoMudar={(turnos) => guardarConversa({ id: endereco.conversa, caso: casoDaConversa.current ?? casoInicial ?? null, turnos })}
        executar={executar}
        falhaRede="Não foi possível montar a resposta neste navegador."
        dataInicial={vigencia}
        casos={e?.casos.map((x) => ({ id: x.id, titulo: x.titulo }))}
        casoInicial={casoInicial && e?.casos.some((x) => x.id === casoInicial) ? casoInicial : ""}
        nome={eu?.nome.split(" ")[0]}
        minimo={modo === "extrativo" ? 8 : 2}
        notaAnexos={modo === "extrativo" ? "Sem IA, o texto do anexo é lido mas não entra na resposta. Escolha um modelo em Resposta para ele ser considerado." : undefined}
        opcoesCampo={
          <span className="app-data">
            <span className="app-data-rotulo">Resposta</span>
            <Seletor value={modo} onChange={(v) => escolher(v as Modo)} rotulo="Quem redige a resposta" compacto opcoes={MODOS.map((m) => ({ valor: m.id, rotulo: m.nome }))} />
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
              <CamposChave c={c} trocar={(p) => escolher(p)} />
            </div>
          ) : null
        }
      />}
    </>
  );
}
