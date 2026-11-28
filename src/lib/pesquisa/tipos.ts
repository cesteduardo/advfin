/** Um dispositivo recuperado da base normativa, como o modelo e a interface o recebem. */
export interface Trecho {
  /** Identificador curto usado na conversa com o modelo: D1, D2… */
  ref: string;
  id: string;
  norma: string; // "EC 132/2023"
  ementa: string;
  url: string;
  rotulo: string; // "ADCT, art. 125"
  texto: string;
  vigenciaInicio: string; // AAAA-MM-DD
  vigenciaFim: string | null;
  curadoria: "rascunho" | "em_revisao" | "publicado" | "rejeitado";
  origem: "ingestao" | "semente";
  /** Fração das palavras da pergunta presentes no dispositivo (termos.ts). */
  aderencia?: number;
}

/** O que o modelo devolve: texto com marcas [Dn] e as citações literais que as sustentam. */
export interface RespostaModelo {
  paragrafos: string[];
  citacoes: { ref: string; trecho: string }[];
  /** O modelo pode declarar que os trechos não bastam para responder. */
  semBase?: boolean;
}

export interface CitacaoVerificada {
  ref: string;
  trecho: string;
  dispositivo: Trecho;
}

export type ResultadoVerificacao =
  | { ok: true; citacoes: CitacaoVerificada[] }
  | { ok: false; motivos: string[] };

export type DesfechoPesquisa =
  | {
      status: "respondida";
      id: string;
      paragrafos: string[];
      citacoes: CitacaoVerificada[];
      fontes: Trecho[];
      redigida: boolean;
      modelo: string;
    }
  | { status: "bloqueada_citacao"; id: string; motivos: string[]; fontes: Trecho[]; modelo: string }
  | { status: "sem_resultado"; id: string; fontes: [] }
  /** Conversa livre do modelo, sem dispositivo da base por trás: nunca leva marca de fonte. */
  | { status: "conversa"; id: string; paragrafos: string[]; fontes: Trecho[]; modelo: string }
  | { status: "erro"; id: string; mensagem: string; fontes: Trecho[] };

/** Bastidores de uma consulta, para a página de desenvolvedor. Nunca vai para o advogado. */
export interface Diagnostico {
  provedor: string;
  modelo: string;
  sistema: string | null;
  mensagem: string | null;
  saidaBruta: string | null;
  respostaLida: unknown;
  ms: { recuperacao: number; modelo: number; verificacao: number; total: number };
  tokens: { entrada: number | null; saida: number | null };
  custoMicroreais: number | null;
  /** Custo em dólar, quando a chamada sai do navegador (laboratório estático) com a tabela da Anthropic. */
  custoUsd?: number | null;
  erro?: string;
}
