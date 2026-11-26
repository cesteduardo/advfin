/**
 * Motor determinístico de transição IBS/CBS.
 *
 * Função pura: mesma entrada, mesma saída, sem rede, sem modelo de linguagem.
 * O LLM pode explicar este resultado, nunca produzi-lo.
 */

import { aplicarAliquota, assertCentavos, assertPpm, escalarPpm, type Centavos, type Ppm } from "./money";
import { REFERENCIA_ESTIMADA, REGIMES, regraDoAno, type Fonte, type Regime } from "./cronograma";

export interface EntradaCalculo {
  ano: number;
  /** Valor da operação, sem tributos, em centavos. */
  valor: Centavos;
  regime: Regime;
  /** Tributos atuais da operação, informados pelo usuário. */
  atual: { pisCofins: Ppm; icms: Ppm; iss: Ppm };
  /** Alíquotas de referência; se omitidas, usa a estimativa vigente no sistema. */
  referencia?: { cbs: Ppm; ibs: Ppm };
}

export interface LinhaTributo {
  tributo: "CBS" | "IBS" | "PIS/Cofins" | "ICMS" | "ISS";
  aliquota: Ppm;
  valor: Centavos;
}

export interface ResultadoCalculo {
  ano: number;
  regime: Regime;
  /** Carga do regime atual integral (antes da Reforma), como base de comparação. */
  base: { linhas: LinhaTributo[]; total: Centavos };
  /** Tributos devidos no ano escolhido. */
  ano_: { linhas: LinhaTributo[]; total: Centavos };
  /** CBS/IBS destacados mas compensados (fase de teste de 2026). */
  destacadoCompensado: Centavos;
  /** total do ano − total da base. Negativo = carga menor. */
  diferenca: Centavos;
  fontes: Fonte[];
}

function validar(e: EntradaCalculo): void {
  assertCentavos(e.valor, "valor da operação");
  assertPpm(e.atual.pisCofins, "PIS/Cofins");
  assertPpm(e.atual.icms, "ICMS");
  assertPpm(e.atual.iss, "ISS");
  if (e.referencia) {
    assertPpm(e.referencia.cbs, "CBS de referência");
    assertPpm(e.referencia.ibs, "IBS de referência");
  }
  if (!(e.regime in REGIMES)) throw new RangeError(`regime desconhecido: ${e.regime}`);
}

const linha = (tributo: LinhaTributo["tributo"], aliquota: Ppm, valor: Centavos): LinhaTributo => ({
  tributo,
  aliquota,
  valor: aplicarAliquota(valor, aliquota),
});

const soma = (ls: LinhaTributo[]) => ls.reduce((s, l) => s + l.valor, 0);

export function calcular(e: EntradaCalculo): ResultadoCalculo {
  validar(e);
  const regra = regraDoAno(e.ano);
  const regime = REGIMES[e.regime];
  const ref = e.referencia ?? { cbs: REFERENCIA_ESTIMADA.cbs, ibs: REFERENCIA_ESTIMADA.ibs };
  const fontes: Fonte[] = [...regra.fontes, regime.fonte];

  // Alíquotas cheias de CBS/IBS no ano, antes do regime diferenciado.
  let cbsCheia: Ppm;
  switch (regra.cbs.tipo) {
    case "fixa":
      cbsCheia = regra.cbs.ppm;
      break;
    case "referencia_menos":
      cbsCheia = Math.max(0, ref.cbs - regra.cbs.deducaoPpm);
      break;
    case "referencia":
      cbsCheia = ref.cbs;
      break;
  }
  const ibsCheia: Ppm =
    regra.ibs.tipo === "fixa" ? regra.ibs.ppm : escalarPpm(ref.ibs, regra.ibs.num, regra.ibs.den);

  if (regra.cbs.tipo !== "fixa" || regra.ibs.tipo !== "fixa") {
    fontes.push(
      e.referencia
        ? { rotulo: "Alíquotas de referência informadas pelo usuário", status: "premissa", conferido: false }
        : REFERENCIA_ESTIMADA.fonte,
    );
  }

  const cbs = escalarPpm(cbsCheia, regime.fator.num, regime.fator.den);
  const ibs = escalarPpm(ibsCheia, regime.fator.num, regime.fator.den);

  const { num, den } = regra.icmsIssFracao;
  const linhasAno: LinhaTributo[] = [];
  if (regra.pisCofins) linhasAno.push(linha("PIS/Cofins", e.atual.pisCofins, e.valor));
  if (num > 0) {
    linhasAno.push(linha("ICMS", escalarPpm(e.atual.icms, num, den), e.valor));
    linhasAno.push(linha("ISS", escalarPpm(e.atual.iss, num, den), e.valor));
  }
  const linhaCbs = linha("CBS", cbs, e.valor);
  const linhaIbs = linha("IBS", ibs, e.valor);
  linhasAno.push(linhaCbs, linhaIbs);

  // Fase de teste: CBS/IBS destacados abatem PIS/Cofins; a carga efetiva não muda.
  let destacadoCompensado = 0;
  if (regra.compensavelComPisCofins) {
    const pis = linhasAno.find((l) => l.tributo === "PIS/Cofins")!;
    destacadoCompensado = Math.min(linhaCbs.valor + linhaIbs.valor, pis.valor);
    fontes.push({
      rotulo: "Compensação modelada até o limite do PIS/Cofins devido na mesma operação",
      status: "premissa",
      conferido: false,
    });
  }

  const linhasBase: LinhaTributo[] = [
    linha("PIS/Cofins", e.atual.pisCofins, e.valor),
    linha("ICMS", e.atual.icms, e.valor),
    linha("ISS", e.atual.iss, e.valor),
  ];

  fontes.push({
    rotulo:
      "Carga nominal sobre o mesmo valor da operação, sem cálculo por dentro, sem créditos e sem Imposto Seletivo",
    status: "premissa",
    conferido: false,
  });

  const totalBase = soma(linhasBase);
  const totalAno = soma(linhasAno) - destacadoCompensado;

  return {
    ano: e.ano,
    regime: e.regime,
    base: { linhas: linhasBase, total: totalBase },
    ano_: { linhas: linhasAno, total: totalAno },
    destacadoCompensado,
    diferenca: totalAno - totalBase,
    fontes,
  };
}

/** Linha do tempo 2026–2033 para os mesmos parâmetros. */
export function linhaDoTempo(e: Omit<EntradaCalculo, "ano">): ResultadoCalculo[] {
  const anos = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];
  return anos.map((ano) => calcular({ ...e, ano }));
}
