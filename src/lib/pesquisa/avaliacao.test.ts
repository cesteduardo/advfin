import { describe, expect, it } from "vitest";
import { pontuar, resumir, rotuloConfere, type PerguntaAvaliacao } from "./avaliacao";
import type { CitacaoVerificada, Trecho } from "./tipos";

const disp = (rotulo: string, norma = "EC 132/2023", texto = "Em 2026, a CBS à alíquota de 0,9%.", inicio = "2023-12-21"): CitacaoVerificada => ({
  ref: "D1",
  trecho: texto,
  dispositivo: { ref: "D1", id: rotulo + norma, norma, ementa: "", url: "", rotulo, texto, vigenciaInicio: inicio, vigenciaFim: null, curadoria: "em_revisao", origem: "semente" } as Trecho,
});
const P = (g: Partial<PerguntaAvaliacao["gabarito"]> | null, esperado: PerguntaAvaliacao["esperado"] = "responder"): PerguntaAvaliacao => ({
  id: "Q1", categoria: "t", pergunta: "?", data: "2026-06-01", esperado, gabarito_conferido: false, conferir_numeracao: false,
  gabarito: g ? { normas: [], rotulos: [], termos: [], ...g } : null,
});

describe("pontuação da avaliação", () => {
  it("rótulo do gabarito cobre caput e parágrafos, sem confundir art. 12 com art. 125", () => {
    expect(rotuloConfere("ADCT, art. 125, § 1º", "ADCT, art. 125")).toBe(true);
    expect(rotuloConfere("ADCT, art. 125, caput", "adct,art. 125")).toBe(true);
    expect(rotuloConfere("ADCT, art. 125", "ADCT, art. 12")).toBe(false);
    expect(rotuloConfere("art. 9º, § 1º", "art. 9º")).toBe(true);
    expect(rotuloConfere("art. 90", "art. 9º")).toBe(false);
  });

  it("conta citação certa, errada, fora de vigência e por termo", () => {
    const n = pontuar(P({ normas: ["EC 132/2023"], rotulos: ["ADCT, art. 125"] }), {
      status: "respondida",
      citacoes: [disp("ADCT, art. 125, caput"), disp("ADCT, art. 127"), disp("ADCT, art. 125, § 1º", "EC 132/2023", "x", "2027-01-01")],
    });
    expect(n).toMatchObject({ citadas: 3, corretas: 1, acerto: true });
    expect(n.erradas.map((e) => e.motivo)).toEqual([expect.stringMatching(/fora do gabarito/), "dispositivo fora de vigência na data"]);
    const t = pontuar(P({ normas: ["EC 132/2023"], termos: ["0,9%"] }), { status: "respondida", citacoes: [disp("qualquer")] });
    expect(t.corretas).toBe(1);
  });

  it("fora do escopo: abster é acerto; responder conta todas as citações como erradas", () => {
    expect(pontuar(P(null, "sem_base"), { status: "sem_resultado" }).acerto).toBe(true);
    expect(pontuar(P(null, "sem_base"), { status: "bloqueada_citacao" }).acerto).toBe(true);
    const n = pontuar(P(null, "sem_base"), { status: "respondida", citacoes: [disp("ADCT, art. 125")] });
    expect(n).toMatchObject({ citadas: 1, corretas: 0, acerto: false });
  });

  it("resume precisão, cobertura e abstenção", () => {
    const ps = [P({ rotulos: ["ADCT, art. 125"] }), { ...P(null, "sem_base"), id: "Q2" }];
    const ns = [
      pontuar(ps[0], { status: "respondida", citacoes: [disp("ADCT, art. 125")] }),
      pontuar(ps[1], { status: "sem_resultado" }),
    ];
    expect(resumir(ps, ns)).toMatchObject({ precisao: 1, cobertura: 1, abstencao: 1, respondidas: 1, semResultado: 1 });
  });
});
