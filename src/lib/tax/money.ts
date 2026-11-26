/**
 * Aritmética monetária exata.
 *
 * Valores em centavos (inteiros). Alíquotas em "ppm" (partes por milhão):
 * 1% = 10_000 ppm; 0,9% = 9_000 ppm; 17,7% = 177_000 ppm.
 * Nenhum ponto flutuante participa de um cálculo de tributo.
 */

export type Centavos = number;
export type Ppm = number;

export const PPM_POR_PONTO_PERCENTUAL = 10_000;

export function assertCentavos(v: number, nome = "valor"): void {
  if (!Number.isSafeInteger(v) || v < 0) {
    throw new RangeError(`${nome} deve ser um inteiro de centavos >= 0 (recebido: ${v})`);
  }
}

export function assertPpm(v: number, nome = "alíquota"): void {
  if (!Number.isSafeInteger(v) || v < 0 || v > 1_000_000) {
    throw new RangeError(`${nome} deve ser um inteiro de ppm entre 0 e 1.000.000 (recebido: ${v})`);
  }
}

/** Converte "12,5" ou "12.5" (percentual) em ppm, sem float. Aceita até 4 casas. */
export function percentualParaPpm(texto: string): Ppm {
  const limpo = texto.trim().replace(",", ".");
  const m = /^(\d{1,3})(?:\.(\d{1,4}))?$/.exec(limpo);
  if (!m) throw new RangeError(`percentual inválido: "${texto}"`);
  const inteiro = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(4, "0"));
  const ppm = inteiro * PPM_POR_PONTO_PERCENTUAL + frac;
  assertPpm(ppm);
  return ppm;
}

/** Converte "1.234,56" ou "1234.56" em centavos, sem float. */
export function reaisParaCentavos(texto: string): Centavos {
  let t = texto.trim().replace(/^R\$\s*/, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) throw new RangeError(`valor inválido: "${texto}"`);
  const v = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  assertCentavos(v);
  return v;
}

/**
 * valor × alíquota, arredondado meio-para-cima ao centavo (regra usual de
 * arredondamento fiscal). Usa BigInt para não haver estouro nem float.
 */
export function aplicarAliquota(valor: Centavos, aliquota: Ppm): Centavos {
  assertCentavos(valor);
  assertPpm(aliquota);
  const produto = BigInt(valor) * BigInt(aliquota);
  const q = produto / 1_000_000n;
  const r = produto % 1_000_000n;
  return Number(r * 2n >= 1_000_000n ? q + 1n : q);
}

/** alíquota × fator, onde fator é uma fração exata num/den (ex.: redução de 60% = 4/10). */
export function escalarPpm(aliquota: Ppm, num: number, den: number): Ppm {
  assertPpm(aliquota);
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || den <= 0 || num < 0) {
    throw new RangeError("fração inválida");
  }
  const p = BigInt(aliquota) * BigInt(num);
  const d = BigInt(den);
  const q = p / d;
  return Number((p % d) * 2n >= d ? q + 1n : q);
}

export function formatarReais(c: Centavos): string {
  const sinal = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  const reais = Math.floor(abs / 100).toLocaleString("pt-BR");
  return `${sinal}R$ ${reais},${String(abs % 100).padStart(2, "0")}`;
}

export function formatarPercentual(p: Ppm): string {
  const inteiro = Math.floor(p / PPM_POR_PONTO_PERCENTUAL);
  const frac = String(p % PPM_POR_PONTO_PERCENTUAL).padStart(4, "0").replace(/0+$/, "");
  return frac ? `${inteiro},${frac}%` : `${inteiro}%`;
}
