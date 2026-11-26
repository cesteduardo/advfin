/**
 * Apuração de IBS/CBS com créditos (não cumulatividade), ano a ano.
 *
 * Função pura, inteiros apenas. Débito sobre as vendas menos crédito sobre as
 * compras que geram crédito. Simplificações declaradas em `premissas`.
 */
import { aliquotasIbsCbs } from "./engine";
import { regraDoAno, ANO_INICIAL, ANO_FINAL, type Regime } from "./cronograma";
import { aplicarAliquota, assertCentavos, type Centavos, type Ppm } from "./money";

export interface EntradaApuracao {
  /** Vendas do período, sem tributos, em centavos. */
  vendas: Centavos;
  regimeVendas: Regime;
  /** Compras e insumos que dão direito a crédito, sem tributos, em centavos. */
  comprasComCredito: Centavos;
  regimeCompras: Regime;
  referencia?: { cbs: Ppm; ibs: Ppm };
}

export interface ApuracaoAno {
  ano: number;
  aliquotas: { vendas: { cbs: Ppm; ibs: Ppm }; compras: { cbs: Ppm; ibs: Ppm } };
  debito: { cbs: Centavos; ibs: Centavos };
  credito: { cbs: Centavos; ibs: Centavos };
  /** Devido por tributo (nunca negativo). */
  devido: { cbs: Centavos; ibs: Centavos; total: Centavos };
  /** Crédito que excede o débito no ano (por tributo, somado). */
  saldoCredor: Centavos;
  /** 2026: o devido é compensável com PIS/Cofins; não é carga adicional. */
  compensavelComPisCofins: boolean;
}

export const PREMISSAS_APURACAO = [
  "Débito e crédito pela alíquota nominal do ano sobre valores sem tributo, sem cálculo por dentro.",
  "CBS e IBS apurados separadamente; crédito de um não abate o outro.",
  "Saldo credor mostrado por ano, sem transporte entre períodos nem ressarcimento.",
  "Todas as compras informadas geram crédito integral (sem uso e consumo pessoal nem vedações).",
  "Sem Imposto Seletivo, regimes específicos e split payment.",
];

export function apurarAno(e: EntradaApuracao, ano: number): ApuracaoAno {
  assertCentavos(e.vendas, "vendas");
  assertCentavos(e.comprasComCredito, "compras");
  const av = aliquotasIbsCbs(ano, e.regimeVendas, e.referencia);
  const ac = aliquotasIbsCbs(ano, e.regimeCompras, e.referencia);
  const debito = { cbs: aplicarAliquota(e.vendas, av.cbs), ibs: aplicarAliquota(e.vendas, av.ibs) };
  const credito = { cbs: aplicarAliquota(e.comprasComCredito, ac.cbs), ibs: aplicarAliquota(e.comprasComCredito, ac.ibs) };
  const devCbs = Math.max(0, debito.cbs - credito.cbs);
  const devIbs = Math.max(0, debito.ibs - credito.ibs);
  const saldo = Math.max(0, credito.cbs - debito.cbs) + Math.max(0, credito.ibs - debito.ibs);
  return {
    ano,
    aliquotas: { vendas: { cbs: av.cbs, ibs: av.ibs }, compras: { cbs: ac.cbs, ibs: ac.ibs } },
    debito,
    credito,
    devido: { cbs: devCbs, ibs: devIbs, total: devCbs + devIbs },
    saldoCredor: saldo,
    compensavelComPisCofins: regraDoAno(ano).compensavelComPisCofins,
  };
}

export function apurarTransicao(e: EntradaApuracao): ApuracaoAno[] {
  const anos: number[] = [];
  for (let a = ANO_INICIAL; a <= ANO_FINAL; a++) anos.push(a);
  return anos.map((a) => apurarAno(e, a));
}
