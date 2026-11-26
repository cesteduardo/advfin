import { describe, expect, it } from "vitest";
import { calcular, linhaDoTempo } from "./engine";
import { aplicarAliquota, escalarPpm, formatarPercentual, formatarReais, percentualParaPpm, reaisParaCentavos } from "./money";

const atualMercadoriaSP = { pisCofins: 92_500, icms: 180_000, iss: 0 }; // 9,25% + 18%
const servico = { pisCofins: 92_500, icms: 0, iss: 50_000 }; // 9,25% + ISS 5%
const ref = { cbs: 88_000, ibs: 177_000 };

describe("money", () => {
  it("converte percentuais sem float", () => {
    expect(percentualParaPpm("0,9")).toBe(9_000);
    expect(percentualParaPpm("17.7")).toBe(177_000);
    expect(percentualParaPpm("9,25")).toBe(92_500);
    expect(percentualParaPpm("0,0001")).toBe(1);
    expect(() => percentualParaPpm("abc")).toThrow();
    expect(() => percentualParaPpm("101")).toThrow();
  });

  it("converte reais em centavos", () => {
    expect(reaisParaCentavos("1.234,56")).toBe(123_456);
    expect(reaisParaCentavos("R$ 10")).toBe(1_000);
    expect(reaisParaCentavos("0,1")).toBe(10);
    expect(() => reaisParaCentavos("-5")).toThrow();
  });

  it("arredonda meio-para-cima ao centavo", () => {
    expect(aplicarAliquota(150, 10_000)).toBe(2); // 1,5 centavo -> 2
    expect(aplicarAliquota(149, 10_000)).toBe(1); // 1,49 -> 1
    expect(aplicarAliquota(100_000, 9_000)).toBe(900);
  });

  it("não perde precisão em valores grandes", () => {
    // R$ 90 trilhões × 26,5%
    expect(aplicarAliquota(9_000_000_000_000_000, 265_000)).toBe(2_385_000_000_000_000);
  });

  it("escala alíquotas por frações exatas", () => {
    expect(escalarPpm(177_000, 4, 10)).toBe(70_800);
    expect(escalarPpm(180_000, 9, 10)).toBe(162_000);
    expect(escalarPpm(1, 1, 2)).toBe(1); // 0,5 -> 1
  });

  it("formata em pt-BR", () => {
    expect(formatarReais(123_456_789)).toBe("R$ 1.234.567,89");
    expect(formatarPercentual(9_000)).toBe("0,9%");
    expect(formatarPercentual(265_000)).toBe("26,5%");
    expect(formatarPercentual(180_000)).toBe("18%");
  });
});

describe("motor IBS/CBS — cronograma", () => {
  const base = { valor: 100_000, regime: "padrao" as const, atual: atualMercadoriaSP, referencia: ref };

  it("2026: destaca CBS 0,9% e IBS 0,1% e compensa com PIS/Cofins", () => {
    const r = calcular({ ...base, ano: 2026 });
    const cbs = r.ano_.linhas.find((l) => l.tributo === "CBS")!;
    const ibs = r.ano_.linhas.find((l) => l.tributo === "IBS")!;
    expect(cbs).toMatchObject({ aliquota: 9_000, valor: 900 });
    expect(ibs).toMatchObject({ aliquota: 1_000, valor: 100 });
    expect(r.destacadoCompensado).toBe(1_000);
    expect(r.diferenca).toBe(0); // carga efetiva igual à atual
    expect(r.ano_.total).toBe(r.base.total);
  });

  it("2027: extingue PIS/Cofins, CBS = referência − 0,1 p.p., IBS 0,1%, ICMS integral", () => {
    const r = calcular({ ...base, ano: 2027 });
    const trib = Object.fromEntries(r.ano_.linhas.map((l) => [l.tributo, l]));
    expect(trib["PIS/Cofins"]).toBeUndefined();
    expect(trib.CBS.aliquota).toBe(87_000);
    expect(trib.IBS.aliquota).toBe(1_000);
    expect(trib.ICMS.aliquota).toBe(180_000);
    expect(r.ano_.total).toBe(8_700 + 100 + 18_000);
    expect(r.base.total).toBe(9_250 + 18_000);
    expect(r.diferenca).toBe(-450);
  });

  it("2028 segue a mesma regra de 2027", () => {
    const a = calcular({ ...base, ano: 2027 });
    const b = calcular({ ...base, ano: 2028 });
    expect(b.ano_.total).toBe(a.ano_.total);
  });

  it.each([
    [2029, 17_700, 162_000],
    [2030, 35_400, 144_000],
    [2031, 53_100, 126_000],
    [2032, 70_800, 108_000],
  ])("%i: IBS e ICMS na proporção da transição", (ano, ibsPpm, icmsPpm) => {
    const r = calcular({ ...base, ano });
    const trib = Object.fromEntries(r.ano_.linhas.map((l) => [l.tributo, l]));
    expect(trib.IBS.aliquota).toBe(ibsPpm);
    expect(trib.ICMS.aliquota).toBe(icmsPpm);
    expect(trib.CBS.aliquota).toBe(88_000);
  });

  it("2033: ICMS e ISS extintos, IBS e CBS integrais", () => {
    const r = calcular({ ...base, ano: 2033 });
    expect(r.ano_.linhas.map((l) => l.tributo)).toEqual(["CBS", "IBS"]);
    expect(r.ano_.total).toBe(26_500);
  });

  it("anos após 2033 usam a regra final", () => {
    expect(calcular({ ...base, ano: 2040 }).ano_.total).toBe(26_500);
  });

  it("rejeita anos anteriores à transição", () => {
    expect(() => calcular({ ...base, ano: 2025 })).toThrow(RangeError);
  });
});

describe("motor IBS/CBS — regimes diferenciados", () => {
  const e = { ano: 2033, valor: 1_000_000, atual: servico, referencia: ref };

  it("redução de 60% aplica 40% das alíquotas", () => {
    const r = calcular({ ...e, regime: "reducao_60" });
    expect(r.ano_.linhas.find((l) => l.tributo === "CBS")!.aliquota).toBe(35_200);
    expect(r.ano_.linhas.find((l) => l.tributo === "IBS")!.aliquota).toBe(70_800);
    expect(r.ano_.total).toBe(106_000);
  });

  it("redução de 30% aplica 70% das alíquotas", () => {
    const r = calcular({ ...e, regime: "reducao_30" });
    expect(r.ano_.total).toBe(185_500);
  });

  it("alíquota zero zera IBS e CBS", () => {
    const r = calcular({ ...e, regime: "aliquota_zero" });
    expect(r.ano_.total).toBe(0);
  });

  it("serviço: ISS entra na base de comparação, não ICMS", () => {
    const r = calcular({ ...e, ano: 2029, regime: "padrao" });
    const trib = Object.fromEntries(r.ano_.linhas.map((l) => [l.tributo, l]));
    expect(trib.ISS.aliquota).toBe(45_000);
    expect(trib.ICMS.valor).toBe(0);
  });
});

describe("motor IBS/CBS — rastreabilidade e validação", () => {
  it("todo resultado carrega fontes com status", () => {
    for (const r of linhaDoTempo({ valor: 100_000, regime: "padrao", atual: atualMercadoriaSP })) {
      expect(r.fontes.length).toBeGreaterThan(0);
      expect(r.fontes.some((f) => f.status === "norma")).toBe(true);
      for (const f of r.fontes) expect(["norma", "estimativa", "premissa"]).toContain(f.status);
    }
  });

  it("sem referência informada, sinaliza que usou estimativa", () => {
    const r = calcular({ ano: 2033, valor: 100, regime: "padrao", atual: atualMercadoriaSP });
    expect(r.fontes.some((f) => f.status === "estimativa")).toBe(true);
  });

  it("é determinístico", () => {
    const e = { ano: 2030, valor: 987_654, regime: "reducao_60" as const, atual: atualMercadoriaSP };
    expect(calcular(e)).toEqual(calcular(e));
  });

  it("rejeita entradas inválidas", () => {
    const ok = { ano: 2030, valor: 100, regime: "padrao" as const, atual: atualMercadoriaSP };
    expect(() => calcular({ ...ok, valor: -1 })).toThrow();
    expect(() => calcular({ ...ok, valor: 1.5 })).toThrow();
    expect(() => calcular({ ...ok, atual: { ...ok.atual, icms: 2_000_000 } })).toThrow();
    expect(() => calcular({ ...ok, regime: "x" as never })).toThrow();
  });

  it("linha do tempo cobre 2026 a 2033", () => {
    const t = linhaDoTempo({ valor: 100_000, regime: "padrao", atual: atualMercadoriaSP, referencia: ref });
    expect(t.map((r) => r.ano)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]);
  });
});
