/**
 * Camada de modelo. O resto do sistema conhece só esta interface:
 * trocar de fornecedor é trocar a implementação, não o produto.
 */
export type Tarefa = "pesquisa" | "classificacao";

export interface PedidoLLM {
  tarefa: Tarefa;
  sistema: string;
  mensagem: string;
  /** Pede saída em JSON; a implementação reforça isso como o fornecedor permitir. */
  json?: boolean;
  maxTokens?: number;
}

export interface RespostaLLM {
  texto: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  /** Custo estimado em milionésimos de real, quando a tabela de preço está configurada. */
  custoMicroreais: number | null;
}

export interface ProvedorLLM {
  /** Nome exibido na trilha de auditoria. */
  readonly nome: string;
  /** Provedores sem redação (extrativo) recebem os trechos e respondem sem chamar rede. */
  readonly redige: boolean;
  gerar(p: PedidoLLM): Promise<RespostaLLM>;
}

export class ErroLLM extends Error {
  constructor(
    mensagem: string,
    readonly status?: number,
  ) {
    super(mensagem);
  }
}
