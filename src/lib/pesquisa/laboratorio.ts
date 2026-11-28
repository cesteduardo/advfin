/**
 * Laboratório do chat que roda inteiro no navegador (GitHub Pages, sem servidor).
 *
 * Mesmo fluxo da pesquisa do app: recuperar → gerar → verificar. Muda só a origem:
 * a base é a semente embutida somada à base ampliada (public/base, baixada sob demanda) e o modelo é chamado direto do navegador, com a chave
 * que o próprio desenvolvedor cola (guardada só no navegador dele). Nada é registrado.
 * Uso exclusivo para teste: chave no navegador é aceitável só para quem é dono dela.
 */
import Anthropic from "@anthropic-ai/sdk";
import { recuperarAmpliada } from "./base-ampliada";
import { SISTEMA_CONVERSA, SISTEMA_PESQUISA, lerResposta, montarMensagem, respostaExtrativa, type DocumentoAnexo, type TurnoAnterior } from "./geracao";
import type { DesfechoPesquisa, Diagnostico, RespostaModelo, Trecho } from "./tipos";
import { verificarCitacoes } from "./verificador";

export type ModoLab = "extrativo" | "simulado-inventado" | "anthropic" | "groq" | "openrouter";

/** Preço da Anthropic em US$ por milhão de tokens (entrada, saída). */
export const MODELOS_LAB = [
  { id: "claude-opus-5-5", nome: "Claude Opus 5.5", entrada: 4, saida: 20 },
  { id: "claude-sonnet-5-5", nome: "Claude Sonnet 5.5", entrada: 2, saida: 10 },
  { id: "claude-haiku-5-5", nome: "Claude Haiku 5.5", entrada: 0.1, saida: 0.5 },
] as const;

/**
 * Groq: plano gratuito, API no formato da OpenAI, modelos abertos. Serve para testar sem custo;
 * a Anthropic continua o padrão para uso real. Os limites do plano grátis são por minuto e por dia.
 */
export const URL_GROQ = "https://api.groq.com/openai/v1";
export const MODELOS_GROQ = [
  { id: "llama-3.3-70b-versatile", nome: "Llama 3.3 70B", entrada: 0, saida: 0 },
  { id: "openai/gpt-oss-120b", nome: "GPT-OSS 120B", entrada: 0, saida: 0 },
  { id: "qwen/qwen3-32b", nome: "Qwen 3 32B", entrada: 0, saida: 0 },
] as const;

/**
 * OpenRouter: aceita chamadas direto do navegador (o Groq, não) e tem modelos gratuitos
 * (sufixo ":free"). É o caminho grátis da demonstração estática, que não tem servidor.
 */
export const URL_OPENROUTER = "https://openrouter.ai/api/v1";
export const MODELOS_OPENROUTER = [
  { id: "meta-llama/llama-3.3-70b-instruct:free", nome: "Llama 3.3 70B", entrada: 0, saida: 0 },
  { id: "deepseek/deepseek-chat-v3-0324:free", nome: "DeepSeek V3", entrada: 0, saida: 0 },
  { id: "google/gemma-3-27b-it:free", nome: "Gemma 3 27B", entrada: 0, saida: 0 },
] as const;

/** Modo que usa modelo de verdade (chave do próprio usuário). */
export const usaModelo = (m: ModoLab) => m === "anthropic" || m === "groq" || m === "openrouter";

export class ErroGroq extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly quem: "groq" | "openrouter" = "groq",
  ) {
    super(mensagem);
  }
}

async function pedirCompativel(chave: string, modelo: string, sistema: string, mensagem: string, quem: "groq" | "openrouter", comJson: boolean) {
  const r = await fetch(`${quem === "groq" ? URL_GROQ : URL_OPENROUTER}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${chave}`,
      ...(quem === "openrouter" ? { "x-title": "AdvFin (teste)" } : {}),
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 4096,
      temperature: 0.3,
      ...(comJson ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: sistema + "\n\nResponda somente com um objeto JSON válido, sem texto antes ou depois." },
        { role: "user", content: mensagem },
      ],
    }),
  });
  if (!r.ok) throw new ErroGroq(((await r.text().catch(() => "")) || r.statusText).slice(0, 300), r.status, quem);
  const j = await r.json();
  if (j.error) throw new ErroGroq(String(j.error.message ?? "erro").slice(0, 300), Number(j.error.code) || 502, quem);
  return {
    modelo: (j.model as string) ?? modelo,
    texto: (j.choices?.[0]?.message?.content as string) ?? "",
    entrada: (j.usage?.prompt_tokens as number) ?? 0,
    saida: (j.usage?.completion_tokens as number) ?? 0,
  };
}

/** Modelos grátis que o OpenRouter oferece agora (a lista muda com frequência). */
let gratisAgora: Promise<string[]> | null = null;
function modelosGratis(): Promise<string[]> {
  gratisAgora ??= fetch(`${URL_OPENROUTER}/models`)
    .then((r) => (r.ok ? r.json() : { data: [] }))
    .then((j: { data?: { id: string }[] }) => (j.data ?? []).map((m) => m.id).filter((id) => id.endsWith(":free")))
    .catch(() => []);
  return gratisAgora;
}

/**
 * Chamada aos fornecedores compatíveis com a API da OpenAI. Os modelos grátis do OpenRouter
 * vêm e vão, e nem todos aceitam o modo JSON: se o pedido falha por isso, tenta sem o modo
 * JSON e, se o modelo sumiu ou está sem fila, troca por outro grátis disponível agora.
 */
async function chamarGroq(chave: string, modelo: string, sistema: string, mensagem: string, quem: "groq" | "openrouter" = "groq") {
  const tentar = async (m: string) => {
    try {
      return await pedirCompativel(chave, m, sistema, mensagem, quem, true);
    } catch (e) {
      if (e instanceof ErroGroq && [400, 404, 422].includes(e.status)) return pedirCompativel(chave, m, sistema, mensagem, quem, false);
      throw e;
    }
  };
  try {
    return await tentar(modelo);
  } catch (e) {
    if (quem !== "openrouter" || !(e instanceof ErroGroq) || ![400, 404, 429, 502, 503].includes(e.status)) throw e;
    const conhecidos: string[] = MODELOS_OPENROUTER.map((m) => m.id);
    const livres = await modelosGratis();
    const fila = [...conhecidos.filter((x) => livres.includes(x)), ...livres.filter((x) => !conhecidos.includes(x))].filter((x) => x !== modelo).slice(0, 3);
    let ultimo: unknown = e;
    for (const m of fila) {
      try {
        return await tentar(m);
      } catch (e2) {
        ultimo = e2;
        if (!(e2 instanceof ErroGroq) || e2.status === 401 || e2.status === 402) throw e2;
      }
    }
    throw ultimo;
  }
}

export interface PedidoLab {
  pergunta: string;
  data: string;
  modo: ModoLab;
  chave?: string;
  modelo?: string;
  documentos?: DocumentoAnexo[];
  /** Turnos anteriores da conversa, para perguntas de seguimento. */
  historico?: TurnoAnterior[];
}

/**
 * Resposta de propósito errada: inventa um dispositivo (D99) e "cita" um texto que não
 * está na base. Serve para ver o verificador bloquear, sem gastar chamada de modelo.
 */
function respostaInventada(fontes: Trecho[]): RespostaModelo {
  const base = respostaExtrativa(fontes, 1);
  return {
    paragrafos: [...base.paragrafos, "A alíquota da CBS em 2026 é de 12% para todos os serviços [D99]."],
    citacoes: [...base.citacoes, { ref: "D99", trecho: "a CBS será cobrada à alíquota de 12% sobre todos os serviços" }],
  };
}

async function chamarAnthropic(chave: string, modelo: string, sistema: string, mensagem: string) {
  const client = new Anthropic({ apiKey: chave, dangerouslyAllowBrowser: true });
  // Opus e Sonnet aceitam o fallback do servidor: se o modelo recusar, a própria API tenta outro.
  const comFallback = !modelo.startsWith("claude-haiku");
  const r = await client.beta.messages.create({
    model: modelo,
    max_tokens: 16000,
    system: sistema,
    messages: [{ role: "user", content: mensagem }],
    ...(comFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  const texto = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { r, texto };
}

export const MSG_GROQ_NAVEGADOR =
  "O Groq não aceita chamadas direto do navegador, então aqui, sem servidor, a chave dele não funciona. Ela funciona no app com servidor. Para testar grátis nesta demonstração, use uma chave do OpenRouter (openrouter.ai/keys).";

export function mensagemErroGratis(status: number, quem: "groq" | "openrouter") {
  const nome = quem === "groq" ? "Groq" : "OpenRouter";
  const prefixo = quem === "groq" ? "gsk_" : "sk-or-";
  if (status === 401) return `O ${nome} recusou a chave. Confira se ela foi colada inteira (começa com ${prefixo}).`;
  if (status === 402) return `O ${nome} pediu crédito para este modelo. Escolha um dos modelos grátis da lista.`;
  if (status === 404) return `O ${nome} não encontrou este modelo agora. Escolha outro da lista.`;
  if (status === 429) return `Limite do plano grátis do ${nome} atingido. Espere um minuto e tente de novo, ou troque de modelo.`;
  return `O ${nome} não respondeu (erro ${status}). Tente de novo ou troque de modelo.`;
}

export async function rodarLab(p: PedidoLab): Promise<{ desfecho: DesfechoPesquisa; diagnostico: Diagnostico }> {
  const inicio = performance.now();
  const id = `lab-${Date.now()}`;
  const nomeProvedor =
    p.modo === "anthropic" ? "anthropic (navegador)" : p.modo === "groq" ? "groq (navegador, grátis)" : p.modo === "openrouter" ? "openrouter (navegador, grátis)" : p.modo === "extrativo" ? "extrativo" : "simulado";
  const diag: Diagnostico = {
    provedor: nomeProvedor,
    modelo: usaModelo(p.modo) ? (p.modelo ?? "") : nomeProvedor,
    sistema: null,
    mensagem: null,
    saidaBruta: null,
    respostaLida: null,
    ms: { recuperacao: 0, modelo: 0, verificacao: 0, total: 0 },
    tokens: { entrada: null, saida: null },
    custoMicroreais: null,
    custoUsd: null,
  };
  const fim = (desfecho: DesfechoPesquisa) => {
    diag.ms.total = Math.round(performance.now() - inicio);
    return { desfecho, diagnostico: diag };
  };

  let t = performance.now();
  // Pergunta de seguimento ("e o PIS?"): se a busca sozinha acha pouco, soma a pergunta anterior.
  const anterior = p.historico?.at(-1)?.pergunta;
  let fontes = await recuperarAmpliada(p.pergunta, p.data);
  // Só para quem continua o assunto ("e o PIS?", "e depois?"); um "olá" depois de uma pergunta da Reforma não vira Reforma.
  const seguimento = /^\s*(e|mas|então|entao|e se|e quanto|e depois|e antes|e para|e no|e na|e os|e as|e o|e a)\b/i.test(p.pergunta);
  if (anterior && fontes.length < 3 && (fontes.length > 0 || seguimento)) {
    const juntas = await recuperarAmpliada(`${p.pergunta} ${anterior}`, p.data);
    if (juntas.length > fontes.length) fontes = juntas;
  }
  diag.ms.recuperacao = Math.round(performance.now() - t);
  // Sem dispositivo na base: com IA conectada, ela conversa (avisando que não há fonte conferida).
  if (fontes.length === 0) {
    if (usaModelo(p.modo) && p.chave) return fim(await conversar(p, diag, id, []));
    return fim({ status: "sem_resultado", id, fontes: [] });
  }

  let resposta: RespostaModelo | null;
  t = performance.now();
  try {
    if (p.modo === "anthropic") {
      if (!p.chave) throw new Error("Cole sua chave da Anthropic para usar o modelo de verdade.");
      const modelo = p.modelo ?? MODELOS_LAB[0].id;
      diag.sistema = SISTEMA_PESQUISA;
      diag.mensagem = montarMensagem(p.pergunta, p.data, fontes, p.documentos ?? [], p.historico ?? []);
      const { r, texto } = await chamarAnthropic(p.chave, modelo, diag.sistema, diag.mensagem);
      diag.modelo = r.model;
      diag.saidaBruta = texto || `(sem texto; stop_reason: ${r.stop_reason})`;
      diag.tokens = { entrada: r.usage.input_tokens, saida: r.usage.output_tokens };
      const preco = MODELOS_LAB.find((m) => m.id === r.model);
      if (preco) diag.custoUsd = (r.usage.input_tokens * preco.entrada + r.usage.output_tokens * preco.saida) / 1_000_000;
      if (r.stop_reason === "refusal") {
        diag.ms.modelo = Math.round(performance.now() - t);
        return fim({ status: "erro", id, mensagem: "O modelo recusou a pergunta (stop_reason: refusal).", fontes });
      }
      resposta = lerResposta(texto);
    } else if (p.modo === "groq" || p.modo === "openrouter") {
      if (!p.chave) throw new Error("Cole sua chave grátis para usar o modelo.");
      const lista: readonly { id: string }[] = p.modo === "groq" ? MODELOS_GROQ : MODELOS_OPENROUTER;
      const modelo = p.modelo && lista.some((m) => m.id === p.modelo) ? p.modelo : lista[0].id;
      diag.sistema = SISTEMA_PESQUISA;
      diag.mensagem = montarMensagem(p.pergunta, p.data, fontes, p.documentos ?? [], p.historico ?? []);
      const g = await chamarGroq(p.chave, modelo, diag.sistema, diag.mensagem, p.modo);
      diag.modelo = g.modelo;
      diag.saidaBruta = g.texto || "(sem texto)";
      diag.tokens = { entrada: g.entrada, saida: g.saida };
      diag.custoUsd = 0;
      resposta = lerResposta(g.texto);
    } else {
      resposta = p.modo === "extrativo" ? respostaExtrativa(fontes) : respostaInventada(fontes);
      diag.custoUsd = 0;
    }
  } catch (e) {
    diag.ms.modelo = Math.round(performance.now() - t);
    diag.erro = e instanceof ErroGroq ? `${e.status} ${e.message}` : e instanceof Anthropic.APIError ? `${e.status ?? ""} ${e.message}`.trim() : (e as Error).message;
    const mensagem =
      e instanceof ErroGroq
        ? mensagemErroGratis(e.status, e.quem)
        : e instanceof TypeError
          ? p.modo === "groq"
            ? MSG_GROQ_NAVEGADOR
            : "O navegador não conseguiu falar com o fornecedor do modelo. Confira a conexão e desligue bloqueadores (o escudo do Brave, por exemplo) para este site."
          : e instanceof Anthropic.AuthenticationError
        ? "A chave da Anthropic foi recusada. Confira se colou a chave inteira."
        : e instanceof Anthropic.RateLimitError
          ? "Limite de uso da conta Anthropic atingido. Tente de novo em instantes."
          : "O modelo não respondeu. Veja o erro técnico abaixo.";
    return fim({ status: "erro", id, mensagem, fontes });
  }
  diag.ms.modelo = Math.round(performance.now() - t);
  diag.respostaLida = resposta;
  if (resposta?.semBase && usaModelo(p.modo) && p.chave) return fim(await conversar(p, diag, id, fontes));
  // Modelo grátis que respondeu em prosa, fora do formato: vale como conversa, sem número de fonte.
  if (!resposta && usaModelo(p.modo) && diag.saidaBruta && !diag.saidaBruta.startsWith("(sem texto")) {
    let partes: string[] = [];
    try {
      const j = JSON.parse(diag.saidaBruta.slice(diag.saidaBruta.indexOf("{"), diag.saidaBruta.lastIndexOf("}") + 1));
      if (Array.isArray(j.paragrafos)) partes = j.paragrafos.filter((x: unknown) => typeof x === "string");
    } catch {
      partes = diag.saidaBruta.trim().startsWith("{") ? [] : diag.saidaBruta.split(/\n{2,}/);
    }
    const paragrafos = partes.map((x) => x.replace(/\[D\d{1,2}\]/g, "").trim()).filter(Boolean);
    if (paragrafos.length) return fim({ status: "conversa", id, paragrafos, fontes: [], modelo: diag.modelo });
  }

  t = performance.now();
  const modelo = diag.modelo;
  let desfecho: DesfechoPesquisa;
  if (!resposta) {
    desfecho = { status: "bloqueada_citacao", id, motivos: ["A resposta do modelo não veio no formato verificável."], fontes, modelo };
  } else {
    const v = verificarCitacoes(resposta, fontes);
    desfecho = v.ok
      ? { status: "respondida", id, paragrafos: resposta.paragrafos, citacoes: v.citacoes, fontes, redigida: usaModelo(p.modo), modelo }
      : { status: "bloqueada_citacao", id, motivos: v.motivos, fontes, modelo };
  }
  diag.ms.verificacao = Math.round(performance.now() - t);
  return fim(desfecho);
}

/** Conversa livre: o modelo responde com o próprio conhecimento, sem marcas de fonte. */
async function conversar(p: PedidoLab, diag: Diagnostico, id: string, fontes: Trecho[]): Promise<DesfechoPesquisa> {
  const t = performance.now();
  diag.sistema = SISTEMA_CONVERSA;
  diag.mensagem = montarMensagem(p.pergunta, p.data, [], p.documentos ?? [], p.historico ?? []);
  try {
    let texto: string;
    if (p.modo === "anthropic") {
      const r = await chamarAnthropic(p.chave!, p.modelo ?? MODELOS_LAB[0].id, diag.sistema, diag.mensagem);
      texto = r.texto;
      diag.modelo = r.r.model;
    } else {
      const quem = p.modo === "groq" ? "groq" : "openrouter";
      const lista: readonly { id: string }[] = quem === "groq" ? MODELOS_GROQ : MODELOS_OPENROUTER;
      const modelo = p.modelo && lista.some((m) => m.id === p.modelo) ? p.modelo : lista[0].id;
      const g = await chamarGroq(p.chave!, modelo, diag.sistema, diag.mensagem, quem);
      texto = g.texto;
      diag.modelo = g.modelo;
    }
    diag.saidaBruta = texto;
    let paragrafos: string[] = [];
    try {
      const j = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
      if (Array.isArray(j.paragrafos)) paragrafos = j.paragrafos.filter((x: unknown) => typeof x === "string");
    } catch {
      paragrafos = texto.split(/\n{2,}/);
    }
    // Garantia: nada sem conferência leva número de fonte.
    paragrafos = paragrafos.map((x) => x.replace(/\[D\d{1,2}\]/g, "").trim()).filter(Boolean);
    diag.ms.modelo += Math.round(performance.now() - t);
    if (!paragrafos.length) return { status: "erro", id, mensagem: "O modelo não respondeu desta vez. Tente de novo.", fontes };
    return { status: "conversa", id, paragrafos, fontes, modelo: diag.modelo };
  } catch (e) {
    diag.erro = (e as Error).message;
    return {
      status: "erro",
      id,
      mensagem: e instanceof ErroGroq ? mensagemErroGratis(e.status, e.quem) : "O modelo não respondeu. Confira a chave em Resposta e tente de novo.",
      fontes,
    };
  }
}

export type ProvedorNavegador = "anthropic" | "groq" | "openrouter";
export const NOME_PROVEDOR: Record<ProvedorNavegador, string> = { anthropic: "Anthropic", groq: "Groq", openrouter: "OpenRouter" };

/** De quem é a chave, pelo começo dela. */
export function provedorDaChave(chave: string): ProvedorNavegador | null {
  const c = chave.trim();
  if (c.startsWith("sk-ant-")) return "anthropic";
  if (c.startsWith("sk-or-")) return "openrouter";
  if (c.startsWith("gsk_")) return "groq";
  return null;
}

/** Confere a chave com uma chamada leve, sem gastar tokens. */
export async function testarChave(provedor: ProvedorNavegador, chave: string): Promise<{ ok: boolean; mensagem: string }> {
  const c = chave.trim();
  const nome = NOME_PROVEDOR[provedor];
  if (!c) return { ok: false, mensagem: "Cole a chave antes de salvar." };
  const dona = provedorDaChave(c);
  if (dona && dona !== provedor) return { ok: false, mensagem: `Essa chave é do ${NOME_PROVEDOR[dona]}, não do ${nome}. Troque a opção em Resposta.` };
  try {
    if (provedor === "anthropic") {
      await new Anthropic({ apiKey: c, dangerouslyAllowBrowser: true }).models.list({ limit: 1 });
      return { ok: true, mensagem: "Chave válida. Conectado à Anthropic." };
    }
    const url = provedor === "groq" ? `${URL_GROQ}/models` : `${URL_OPENROUTER}/key`;
    const r = await fetch(url, { headers: { authorization: `Bearer ${c}` } });
    if (!r.ok) return { ok: false, mensagem: mensagemErroGratis(r.status, provedor) };
    return { ok: true, mensagem: `Chave válida. Conectado ao ${nome}, nos modelos grátis.` };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, mensagem: "A Anthropic recusou a chave. Confira se ela foi colada inteira (começa com sk-ant-)." };
    if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, mensagem: "A chave da Anthropic não tem permissão para a API. Confira no console da Anthropic." };
    if (e instanceof Anthropic.APIError && e.status) return { ok: false, mensagem: `A Anthropic respondeu com erro ${e.status}. Tente de novo.` };
    if (provedor === "groq") return { ok: false, mensagem: MSG_GROQ_NAVEGADOR };
    return { ok: false, mensagem: `O navegador não conseguiu falar com o ${nome}. Confira a conexão e desligue bloqueadores (o escudo do Brave, por exemplo) para este site.` };
  }
}

const SISTEMA_REVISAO = `Você revisa textos ditados por voz, em português do Brasil. Corrija ortografia, acentuação, pontuação, maiúsculas e siglas (IBS, CBS, ICMS, ISS, PIS, Cofins, LC, EC), como um bom revisor faria.
Não mude o sentido, não acrescente nem tire informações, não responda à pergunta, não comente. Mantenha a pessoa e o tom de quem falou. Pergunta termina com ponto de interrogação.
Formato da resposta (JSON): {"texto": "..."}`;

/**
 * Revisão rápida do texto ditado pelo modelo conectado. Devolve o texto revisado, ou o original
 * se o modelo demorar, falhar ou devolver algo que não parece o mesmo texto.
 */
export async function revisarComModelo(modo: ModoLab, chave: string, modelo: string | undefined, texto: string, limiteMs = 4000): Promise<string> {
  if (!usaModelo(modo) || !chave || texto.trim().length < 3) return texto;
  const tarefa = (async () => {
    const mensagem = `<ditado>${texto}</ditado>`;
    let bruto: string;
    if (modo === "anthropic") {
      // Revisão é tarefa curta: vai ao modelo mais rápido da família.
      bruto = (await chamarAnthropic(chave, MODELOS_LAB[2].id, SISTEMA_REVISAO, mensagem)).texto;
    } else {
      const quem = modo === "groq" ? "groq" : "openrouter";
      const lista: readonly { id: string }[] = quem === "groq" ? MODELOS_GROQ : MODELOS_OPENROUTER;
      bruto = (await chamarGroq(chave, modelo && lista.some((m) => m.id === modelo) ? modelo : lista[0].id, SISTEMA_REVISAO, mensagem, quem)).texto;
    }
    let novo = "";
    try {
      novo = String(JSON.parse(bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1)).texto ?? "");
    } catch {
      novo = bruto;
    }
    novo = novo.replace(/<\/?ditado>/g, "").trim();
    // Guarda: revisão não reescreve. Tamanho muito diferente é sinal de que o modelo respondeu em vez de revisar.
    const razao = novo.length / Math.max(1, texto.length);
    return novo && razao > 0.7 && razao < 1.4 ? novo : texto;
  })();
  return Promise.race([tarefa.catch(() => texto), new Promise<string>((r) => setTimeout(() => r(texto), limiteMs))]);
}
