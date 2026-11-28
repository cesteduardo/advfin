import { describe, expect, it } from "vitest";
import { pontuarLocal } from "./ortografia";

describe("pontuação do texto ditado", () => {
  it("maiúscula, siglas e sinal de pergunta", () => {
    expect(pontuarLocal("quando o icms deixa de existir")).toBe("Quando o ICMS deixa de existir?");
    expect(pontuarLocal("será que a cbs vale em 2027")).toBe("Será que a CBS vale em 2027?");
    expect(pontuarLocal("porque o pis acaba")).toBe("Por que o PIS acaba?");
  });
  it("afirmação ganha ponto; pontuação falada vira sinal", () => {
    expect(pontuarLocal("preciso de um parecer vírgula urgente ponto final obrigado")).toBe("Preciso de um parecer, urgente. Obrigado.");
    expect(pontuarLocal("olá boa noite")).toBe("Olá boa noite.");
  });
  it("não mexe no que já veio pontuado", () => {
    expect(pontuarLocal("Qual a alíquota da CBS?")).toBe("Qual a alíquota da CBS?");
  });
});
