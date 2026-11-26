import { describe, expect, it } from "vitest";
import { lerResposta, montarMensagem, respostaExtrativa } from "./geracao";
import type { Trecho } from "./tipos";
import { normalizar, verificarCitacoes } from "./verificador";

const t = (ref: string, texto: string, extra: Partial<Trecho> = {}): Trecho => ({
  ref,
  id: `id-${ref}`,
  norma: "EC 132/2023",
  ementa: "Reforma Tributária",
  url: "https://www.planalto.gov.br/",
  rotulo: `art. ${ref}`,
  texto,
  vigenciaInicio: "2023-12-21",
  vigenciaFim: null,
  curadoria: "em_revisao",
  origem: "semente",
  ...extra,
});

const D1 = t("D1", "Em 2026, o imposto será cobrado à alíquota estadual de 0,1% (um décimo por cento), e a contribuição será cobrada à alíquota de 0,9% (nove décimos por cento).");
const D2 = t("D2", "Ficam extintos, a partir de 2033, os impostos previstos nos arts. 155, II, e 156, III, da Constituição Federal.");
const base = [D1, D2];

describe("verificador de citações", () => {
  it("aprova resposta com citação literal de trecho recuperado", () => {
    const v = verificarCitacoes(
      {
        paragrafos: ["Em 2026 a CBS é cobrada a 0,9% [D1].", "ICMS e ISS deixam de existir em 2033 [D2]."],
        citacoes: [
          { ref: "D1", trecho: "a contribuição será cobrada à alíquota de 0,9% (nove décimos por cento)" },
          { ref: "D2", trecho: "Ficam extintos, a partir de 2033, os impostos" },
        ],
      },
      base,
    );
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.citacoes.map((c) => c.dispositivo.id)).toEqual(["id-D1", "id-D2"]);
  });

  it("tolera diferenças de caixa, acento, espaço e aspas", () => {
    const v = verificarCitacoes(
      { paragrafos: ["Vale [D1]."], citacoes: [{ ref: "D1", trecho: "“EM 2026,   o imposto sera cobrado a aliquota estadual”" }] },
      base,
    );
    expect(v.ok).toBe(true);
  });

  it("bloqueia citação de dispositivo que não foi recuperado (inexistente)", () => {
    const v = verificarCitacoes(
      { paragrafos: ["Há redução [D7]."], citacoes: [{ ref: "D7", trecho: "texto qualquer que parece uma norma real" }] },
      base,
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivos.join(" ")).toMatch(/D7/);
  });

  it("bloqueia trecho que não está no texto do dispositivo (alucinação)", () => {
    const v = verificarCitacoes(
      { paragrafos: ["A CBS é de 1,5% [D1]."], citacoes: [{ ref: "D1", trecho: "a contribuição será cobrada à alíquota de 1,5%" }] },
      base,
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivos[0]).toMatch(/não está no texto/);
  });

  it("bloqueia marca no texto sem citação correspondente", () => {
    const v = verificarCitacoes(
      {
        paragrafos: ["Em 2026 [D1], e em 2033 [D2]."],
        citacoes: [{ ref: "D1", trecho: "o imposto será cobrado à alíquota estadual de 0,1%" }],
      },
      base,
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivos.join(" ")).toMatch(/\[D2\] sem trazer/);
  });

  it("bloqueia parágrafo sem fonte", () => {
    const v = verificarCitacoes(
      {
        paragrafos: ["Em 2026 [D1].", "Além disso, a jurisprudência é pacífica."],
        citacoes: [{ ref: "D1", trecho: "o imposto será cobrado à alíquota estadual de 0,1%" }],
      },
      base,
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivos.join(" ")).toMatch(/parágrafo 2/);
  });

  it("bloqueia citação curta demais e resposta sem citações", () => {
    expect(verificarCitacoes({ paragrafos: ["X [D1]."], citacoes: [{ ref: "D1", trecho: "2026" }] }, base).ok).toBe(false);
    expect(verificarCitacoes({ paragrafos: ["Sem fonte."], citacoes: [] }, base).ok).toBe(false);
  });

  it("bloqueia dispositivo rejeitado pelo curador", () => {
    const rej = t("D1", D1.texto, { curadoria: "rejeitado" });
    const v = verificarCitacoes({ paragrafos: ["X [D1]."], citacoes: [{ ref: "D1", trecho: "o imposto será cobrado à alíquota estadual" }] }, [rej]);
    expect(v.ok).toBe(false);
  });

  it("respeita semBase do modelo", () => {
    const v = verificarCitacoes({ paragrafos: ["Faltam dispositivos sobre o tema."], citacoes: [], semBase: true }, base);
    expect(v.ok).toBe(false);
  });

  it("normaliza º e travessões", () => {
    expect(normalizar("Art. 9º — § 1º")).toBe("art. 9o - § 1o");
  });
});

describe("geração", () => {
  it("lê JSON mesmo com cerca de código e rejeita formato errado", () => {
    expect(lerResposta('```json\n{"paragrafos":["a [D1]"],"citacoes":[{"ref":"D1","trecho":"x"}]}\n```')?.paragrafos).toEqual(["a [D1]"]);
    expect(lerResposta("não sei")).toBeNull();
    expect(lerResposta('{"resposta":"x"}')).toBeNull();
  });

  it("a resposta extrativa sempre passa no verificador", () => {
    const r = respostaExtrativa(base);
    expect(verificarCitacoes(r, base).ok).toBe(true);
  });

  it("a mensagem ao modelo leva a data e os refs", () => {
    const m = montarMensagem("Qual a CBS em 2026?", "2026-11-26", base);
    expect(m).toContain("2026-11-26");
    expect(m).toContain('ref="D2"');
  });
});

describe("trecho inicial da resposta extrativa", () => {
  it("não corta em abreviações e mantém dispositivos curtos inteiros", async () => {
    const { trechoInicial } = await import("./geracao");
    expect(trechoInicial(D1.texto)).toBe(D1.texto);
    const longo = "Em 2027 e 2028, o imposto previsto no art. 156-A será cobrado à alíquota estadual. " + "Texto adicional. ".repeat(40);
    const r = trechoInicial(longo);
    expect(r).toContain("art. 156-A será cobrado");
    expect(longo.startsWith(r)).toBe(true);
  });
});
