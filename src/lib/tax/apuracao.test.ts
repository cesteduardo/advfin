import { describe, expect, it } from "vitest";
import { apurarAno, apurarTransicao } from "./apuracao";
import { classificar } from "./classificacao";

const ref = { cbs: 88_000, ibs: 177_000 };
const base = { vendas: 100_000_00, regimeVendas: "padrao" as const, comprasComCredito: 40_000_00, regimeCompras: "padrao" as const, referencia: ref };

describe("apuração com créditos", () => {
  it("2026: débito 0,9% + 0,1% menos crédito, compensável com PIS/Cofins", () => {
    const a = apurarAno(base, 2026);
    expect(a.debito).toEqual({ cbs: 900_00, ibs: 100_00 });
    expect(a.credito).toEqual({ cbs: 360_00, ibs: 40_00 });
    expect(a.devido).toEqual({ cbs: 540_00, ibs: 60_00, total: 600_00 });
    expect(a.compensavelComPisCofins).toBe(true);
  });

  it("2033: alíquota cheia de referência sobre o valor agregado", () => {
    const a = apurarAno(base, 2033);
    // 60.000 de valor agregado × 26,5%
    expect(a.devido.total).toBe(15_900_00);
    expect(a.saldoCredor).toBe(0);
  });

  it("compras maiores que vendas geram saldo credor, nunca devido negativo", () => {
    const a = apurarAno({ ...base, vendas: 10_000_00, comprasComCredito: 50_000_00 }, 2033);
    expect(a.devido.total).toBe(0);
    expect(a.saldoCredor).toBe(40_000_00 * 0.265);
  });

  it("vendas com redução de 60% e compras no padrão", () => {
    const a = apurarAno({ ...base, regimeVendas: "reducao_60" }, 2033);
    // débito: 100.000 × 10,6% = 10.600; crédito: 40.000 × 26,5% = 10.600
    expect(a.devido.total).toBe(0);
    expect(a.saldoCredor).toBe(0);
  });

  it("cobre os oito anos da transição", () => {
    const t = apurarTransicao(base);
    expect(t.map((x) => x.ano)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]);
    expect(t[0].devido.total).toBeLessThan(t[7].devido.total);
  });

  it("recusa valores inválidos", () => {
    expect(() => apurarAno({ ...base, vendas: -1 }, 2030)).toThrow();
    expect(() => apurarAno({ ...base, vendas: 1.5 }, 2030)).toThrow();
  });
});

describe("classificação NCM/NBS", () => {
  it("casa NCM de 8 dígitos pelo prefixo mais longo, com pontuação", () => {
    const r = classificar("1006.30.21");
    expect(r[0].item.descricao).toMatch(/Arroz/);
    expect(r[0].item.regime).toBe("aliquota_zero");
    expect(r[0].criterio).toBe("codigo");
  });

  it("código sem correspondência não devolve nada (não inventa)", () => {
    expect(classificar("9999.99.99")).toEqual([]);
  });

  it("busca serviço pela descrição", () => {
    const r = classificar("serviços de advocacia");
    expect(r[0].item.regime).toBe("reducao_30");
    expect(classificar("educação infantil")[0].item.regime).toBe("reducao_60");
  });

  it("nada na tabela está conferido ainda", () => {
    expect(classificar("arroz").every((r) => !r.item.conferido)).toBe(true);
  });
});
