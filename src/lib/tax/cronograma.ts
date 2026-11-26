/**
 * Parâmetros normativos da transição (EC 132/2023 e LC 214/2025).
 *
 * Regra da casa: todo número usado em cálculo vive aqui, com a fonte e um
 * status explícito. O motor nunca inventa alíquota; a interface mostra o
 * status ao lado do resultado.
 *
 *  - "norma":      valor literal de dispositivo legal.
 *  - "estimativa": número oficial ainda não fixado em norma (ex.: alíquota
 *                  de referência), editável pelo usuário.
 *  - "premissa":   simplificação de modelagem desta calculadora.
 *
 * `conferido` só vira true depois que o curador tributarista confere o
 * dispositivo na base versionada. Até lá a UI exibe "fonte a conferir".
 */

import type { Ppm } from "./money";

export type StatusFonte = "norma" | "estimativa" | "premissa";

export interface Fonte {
  rotulo: string;
  status: StatusFonte;
  conferido: boolean;
}

export const ANO_INICIAL = 2026;
export const ANO_FINAL = 2033;

/** Alíquotas de referência estimadas (soma ~26,5%), editáveis na calculadora. */
export const REFERENCIA_ESTIMADA = {
  cbs: 88_000 as Ppm, // 8,8%
  ibs: 177_000 as Ppm, // 17,7%
  fonte: {
    rotulo:
      "Estimativa de alíquota de referência (CBS 8,8% + IBS 17,7%). A alíquota efetiva será fixada por resolução do Senado.",
    status: "estimativa",
    conferido: false,
  } satisfies Fonte,
};

export interface RegraAno {
  ano: number;
  /** CBS: alíquota fixa ou derivada da referência. */
  cbs:
    | { tipo: "fixa"; ppm: Ppm }
    | { tipo: "referencia_menos"; deducaoPpm: Ppm }
    | { tipo: "referencia" };
  /** IBS: alíquota fixa ou fração da referência. */
  ibs: { tipo: "fixa"; ppm: Ppm } | { tipo: "fracao_referencia"; num: number; den: number };
  /** Fração remanescente de ICMS e ISS (10/10 = integral; 0 = extinto). */
  icmsIssFracao: { num: number; den: number };
  /** PIS/Cofins ainda cobrados? */
  pisCofins: boolean;
  /** CBS/IBS do ano são compensáveis com PIS/Cofins (fase de teste). */
  compensavelComPisCofins: boolean;
  fontes: Fonte[];
}

const norma = (rotulo: string): Fonte => ({ rotulo, status: "norma", conferido: false });
const premissa = (rotulo: string): Fonte => ({ rotulo, status: "premissa", conferido: false });

export const CRONOGRAMA: readonly RegraAno[] = [
  {
    ano: 2026,
    cbs: { tipo: "fixa", ppm: 9_000 },
    ibs: { tipo: "fixa", ppm: 1_000 },
    icmsIssFracao: { num: 10, den: 10 },
    pisCofins: true,
    compensavelComPisCofins: true,
    fontes: [
      norma("ADCT, art. 125 (EC 132/2023): CBS 0,9% e IBS 0,1% em 2026, compensáveis com PIS/Cofins"),
    ],
  },
  ...[2027, 2028].map(
    (ano): RegraAno => ({
      ano,
      cbs: { tipo: "referencia_menos", deducaoPpm: 1_000 },
      ibs: { tipo: "fixa", ppm: 1_000 },
      icmsIssFracao: { num: 10, den: 10 },
      pisCofins: false,
      compensavelComPisCofins: false,
      fontes: [
        norma("ADCT, art. 126 (EC 132/2023): cobrança da CBS e extinção de PIS/Cofins em 2027"),
        norma("ADCT, art. 127 (EC 132/2023): IBS de 0,1% (0,05% estadual + 0,05% municipal) e CBS reduzida em 0,1 p.p. em 2027 e 2028"),
      ],
    }),
  ),
  ...[
    [2029, 1, 9],
    [2030, 2, 8],
    [2031, 3, 7],
    [2032, 4, 6],
  ].map(
    ([ano, ibsDecimos, icmsDecimos]): RegraAno => ({
      ano,
      cbs: { tipo: "referencia" },
      ibs: { tipo: "fracao_referencia", num: ibsDecimos, den: 10 },
      icmsIssFracao: { num: icmsDecimos, den: 10 },
      pisCofins: false,
      compensavelComPisCofins: false,
      fontes: [
        norma(`ADCT, art. 128 (EC 132/2023): ICMS e ISS reduzidos a ${icmsDecimos}/10 das alíquotas em ${ano}`),
        premissa(`IBS modelado como ${ibsDecimos}/10 da alíquota de referência; a alíquota efetiva do ano será fixada em resolução`),
      ],
    }),
  ),
  {
    ano: 2033,
    cbs: { tipo: "referencia" },
    ibs: { tipo: "fracao_referencia", num: 10, den: 10 },
    icmsIssFracao: { num: 0, den: 10 },
    pisCofins: false,
    compensavelComPisCofins: false,
    fontes: [norma("ADCT, art. 129 (EC 132/2023): extinção de ICMS e ISS a partir de 2033")],
  },
];

export type Regime = "padrao" | "reducao_30" | "reducao_60" | "aliquota_zero";

export const REGIMES: Record<Regime, { rotulo: string; fator: { num: number; den: number }; fonte: Fonte }> = {
  padrao: {
    rotulo: "Alíquota padrão",
    fator: { num: 10, den: 10 },
    fonte: norma("LC 214/2025: alíquota padrão de IBS e CBS"),
  },
  reducao_30: {
    rotulo: "Redução de 30% (profissões intelectuais regulamentadas)",
    fator: { num: 7, den: 10 },
    fonte: norma("EC 132/2023, art. 9º, e LC 214/2025: redução de 30% para profissões intelectuais regulamentadas"),
  },
  reducao_60: {
    rotulo: "Redução de 60% (saúde, educação, alimentos e outros)",
    fator: { num: 4, den: 10 },
    fonte: norma("EC 132/2023, art. 9º, e LC 214/2025: redução de 60% para bens e serviços listados"),
  },
  aliquota_zero: {
    rotulo: "Alíquota zero (Cesta Básica Nacional e outros)",
    fator: { num: 0, den: 10 },
    fonte: norma("EC 132/2023, art. 8º, e LC 214/2025: Cesta Básica Nacional de Alimentos com alíquota zero"),
  },
};

export function regraDoAno(ano: number): RegraAno {
  const r = CRONOGRAMA.find((x) => x.ano === ano) ?? (ano > ANO_FINAL ? CRONOGRAMA.at(-1) : undefined);
  if (!r) throw new RangeError(`ano fora da transição: ${ano} (use ${ANO_INICIAL} em diante)`);
  return r;
}
