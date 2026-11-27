/**
 * Gerar → verificar, a partir dos dispositivos já recuperados. Sem banco e sem
 * "server-only": o mesmo caminho serve ao app (orquestrador.ts) e à avaliação
 * (avaliacao/avaliar.test.ts), para que a nota medida seja a do produto real.
 */
import type { ProvedorLLM } from "@/lib/llm/tipos";
import { SISTEMA_PESQUISA, lerResposta, montarMensagem, respostaExtrativa, type DocumentoAnexo } from "./geracao";
import type { CitacaoVerificada, RespostaModelo, Trecho } from "./tipos";
import { verificarCitacoes } from "./verificador";

export type ResultadoResposta =
  | { status: "respondida"; paragrafos: string[]; citacoes: CitacaoVerificada[] }
  | { status: "bloqueada_citacao"; motivos: string[] };

export interface Bastidores {
  sistema: string | null;
  mensagem: string | null;
  saidaBruta: string | null;
  respostaLida: RespostaModelo | null;
  tokens: { entrada: number | null; saida: number | null; custo: number | null; modelo: string };
  ms: { modelo: number; verificacao: number };
}

export async function responder(llm: ProvedorLLM, pergunta: string, data: string, fontes: Trecho[], documentos: DocumentoAnexo[] = []): Promise<{ resultado: ResultadoResposta; bastidores: Bastidores }> {
  const b: Bastidores = {
    sistema: null,
    mensagem: null,
    saidaBruta: null,
    respostaLida: null,
    tokens: { entrada: null, saida: null, custo: null, modelo: llm.nome },
    ms: { modelo: 0, verificacao: 0 },
  };
  let t = Date.now();
  let resposta: RespostaModelo | null;
  if (llm.redige) {
    b.sistema = SISTEMA_PESQUISA;
    b.mensagem = montarMensagem(pergunta, data, fontes, documentos);
    const r = await llm.gerar({ tarefa: "pesquisa", sistema: b.sistema, mensagem: b.mensagem, json: true, maxTokens: 2048 });
    b.tokens = { entrada: r.tokensEntrada, saida: r.tokensSaida, custo: r.custoMicroreais, modelo: r.modelo };
    b.saidaBruta = r.texto;
    resposta = lerResposta(r.texto);
  } else {
    resposta = respostaExtrativa(fontes);
  }
  b.ms.modelo = Date.now() - t;
  b.respostaLida = resposta;
  t = Date.now();
  let resultado: ResultadoResposta;
  if (!resposta) {
    resultado = { status: "bloqueada_citacao", motivos: ["A resposta do modelo não veio no formato verificável."] };
  } else {
    const v = verificarCitacoes(resposta, fontes);
    resultado = v.ok ? { status: "respondida", paragrafos: resposta.paragrafos, citacoes: v.citacoes } : { status: "bloqueada_citacao", motivos: v.motivos };
  }
  b.ms.verificacao = Date.now() - t;
  return { resultado, bastidores: b };
}
