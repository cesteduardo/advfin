import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASE_LOCAL, recuperarLocal } from "./base-local";
import { rodarLab } from "./laboratorio";

describe("base embutida do laboratório", () => {
  it("tem exatamente os textos da semente SQL", () => {
    const sql = readFileSync("db/seeds/semente_reforma.sql", "utf8").replace(/''/g, "'");
    for (const d of BASE_LOCAL) expect(sql, d.rotulo).toContain(d.texto);
    expect(sql.match(/^\s+\('(ec|lc)', /gm)?.length).toBe(BASE_LOCAL.length);
  });

  it("recupera pela sigla e respeita a vigência", () => {
    const r = recuperarLocal("Qual a alíquota da CBS e do IBS em 2026?", "2026-01-01");
    expect(r[0].rotulo).toBe("ADCT, art. 125, caput");
    expect(r.map((t) => t.ref)).toEqual(r.map((_, i) => `D${i + 1}`));
    expect(recuperarLocal("Imposto Seletivo instituído", "2024-06-01").some((t) => t.norma === "LC 214/2025")).toBe(false);
    expect(recuperarLocal("xyzw", "2026-01-01")).toEqual([]);
  });
});

describe("laboratório no navegador", () => {
  it("o modo sem IA passa pelo verificador", async () => {
    const { desfecho, diagnostico } = await rodarLab({ pergunta: "Quando o ICMS e o ISS deixam de existir?", data: "2026-11-26", modo: "extrativo" });
    expect(desfecho.status).toBe("respondida");
    expect(diagnostico.ms.total).toBeGreaterThanOrEqual(0);
  });

  it("a citação inventada é bloqueada", async () => {
    const { desfecho } = await rodarLab({ pergunta: "Qual a alíquota da CBS em 2026?", data: "2026-11-26", modo: "simulado-inventado" });
    expect(desfecho.status).toBe("bloqueada_citacao");
    if (desfecho.status === "bloqueada_citacao") expect(desfecho.motivos.join(" ")).toMatch(/D99/);
  });

  it("sem chave, o modo Anthropic não chama a rede", async () => {
    const { desfecho } = await rodarLab({ pergunta: "Qual a alíquota da CBS em 2026?", data: "2026-11-26", modo: "anthropic" });
    expect(desfecho.status).toBe("erro");
  });
});
