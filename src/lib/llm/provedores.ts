import "server-only";
import { ErroLLM, type PedidoLLM, type ProvedorLLM, type RespostaLLM, type Tarefa } from "./tipos";

/**
 * Configuração por ambiente:
 *   LLM_PROVEDOR      anthropic | openai | extrativo (padrão: extrativo, sem rede)
 *   LLM_CHAVE         chave de API do fornecedor
 *   LLM_URL_BASE      só para "openai": qualquer API compatível (OpenAI, Azure, Maritaca…)
 *   LLM_MODELO_PESQUISA, LLM_MODELO_CLASSIFICACAO   modelo por tarefa
 *   LLM_PRECO_ENTRADA, LLM_PRECO_SAIDA   R$ por milhão de tokens, para medir custo por consulta
 */
function modeloPara(tarefa: Tarefa, padrao: Record<Tarefa, string>): string {
  const env = tarefa === "pesquisa" ? process.env.LLM_MODELO_PESQUISA : process.env.LLM_MODELO_CLASSIFICACAO;
  return env || padrao[tarefa];
}

function custo(entrada: number, saida: number): number | null {
  const pe = Number(process.env.LLM_PRECO_ENTRADA);
  const ps = Number(process.env.LLM_PRECO_SAIDA);
  if (!pe || !ps) return null;
  // R$ por milhão de tokens × tokens = microreais diretamente.
  return Math.round(entrada * pe + saida * ps);
}

const TEMPO_LIMITE_MS = 60_000;

async function postar(url: string, cabecalhos: Record<string, string>, corpo: unknown): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabecalhos },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!r.ok) {
    const detalhe = (await r.text().catch(() => "")).slice(0, 300);
    throw new ErroLLM(`fornecedor respondeu ${r.status}: ${detalhe}`, r.status);
  }
  return r.json();
}

export class ProvedorAnthropic implements ProvedorLLM {
  readonly nome = "anthropic";
  readonly redige = true;
  constructor(private chave: string) {}

  async gerar(p: PedidoLLM): Promise<RespostaLLM> {
    const modelo = modeloPara(p.tarefa, { pesquisa: "claude-sonnet-5-5", classificacao: "claude-haiku-5-5" });
    const j = await postar(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.chave, "anthropic-version": "2023-06-01" },
      {
        model: modelo,
        max_tokens: p.maxTokens ?? 2048,
        system: p.sistema + (p.json ? "\n\nResponda somente com um objeto JSON válido, sem texto antes ou depois." : ""),
        messages: [{ role: "user", content: p.mensagem }],
      },
    );
    const texto = (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const ent = j.usage?.input_tokens ?? 0;
    const sai = j.usage?.output_tokens ?? 0;
    return { texto, modelo: j.model ?? modelo, tokensEntrada: ent, tokensSaida: sai, custoMicroreais: custo(ent, sai) };
  }
}

/** Qualquer API no formato chat/completions (OpenAI, Azure OpenAI, Maritaca e outras). */
export class ProvedorCompativelOpenAI implements ProvedorLLM {
  readonly nome: string;
  readonly redige = true;
  constructor(
    private chave: string,
    private urlBase = "https://api.openai.com/v1",
  ) {
    this.nome = `openai-compativel(${new URL(urlBase).host})`;
  }

  async gerar(p: PedidoLLM): Promise<RespostaLLM> {
    const modelo = modeloPara(p.tarefa, { pesquisa: "gpt-5", classificacao: "gpt-5-mini" });
    const j = await postar(
      `${this.urlBase.replace(/\/$/, "")}/chat/completions`,
      { authorization: `Bearer ${this.chave}` },
      {
        model: modelo,
        // A API da OpenAI usa max_completion_tokens; as compatíveis, em geral, max_tokens.
        [this.urlBase.includes("api.openai.com") ? "max_completion_tokens" : "max_tokens"]: p.maxTokens ?? 2048,
        ...(p.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: p.sistema },
          { role: "user", content: p.mensagem },
        ],
      },
    );
    const texto = j.choices?.[0]?.message?.content ?? "";
    const ent = j.usage?.prompt_tokens ?? 0;
    const sai = j.usage?.completion_tokens ?? 0;
    return { texto, modelo: j.model ?? modelo, tokensEntrada: ent, tokensSaida: sai, custoMicroreais: custo(ent, sai) };
  }
}

/**
 * Sem modelo: não redige. O orquestrador monta a resposta a partir dos próprios
 * trechos recuperados (ver pesquisa/extrativo.ts). Serve para desenvolvimento e
 * para a pesquisa funcionar antes de haver contrato com um fornecedor.
 */
export class ProvedorExtrativo implements ProvedorLLM {
  readonly nome = "extrativo";
  readonly redige = false;
  async gerar(): Promise<RespostaLLM> {
    throw new ErroLLM("o provedor extrativo não gera texto");
  }
}

let cache: ProvedorLLM | null = null;

export function provedor(): ProvedorLLM {
  if (cache) return cache;
  const nome = (process.env.LLM_PROVEDOR ?? "extrativo").toLowerCase();
  const chave = process.env.LLM_CHAVE ?? "";
  if (nome !== "extrativo" && !chave) {
    console.warn(`LLM_PROVEDOR=${nome} sem LLM_CHAVE; usando o provedor extrativo`);
    return (cache = new ProvedorExtrativo());
  }
  switch (nome) {
    case "anthropic":
      return (cache = new ProvedorAnthropic(chave));
    case "openai":
      return (cache = new ProvedorCompativelOpenAI(chave, process.env.LLM_URL_BASE || undefined));
    default:
      return (cache = new ProvedorExtrativo());
  }
}
