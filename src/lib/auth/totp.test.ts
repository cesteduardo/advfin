import { describe, expect, it } from "vitest";
import { base32, codigoNoPasso, conferirCodigo, decifrar, cifrar, deBase32, hashCodigoRecuperacao, novosCodigosRecuperacao } from "./totp";

// Vetores do RFC 6238 (SHA-1), com 6 dígitos: os 6 finais dos 8 publicados.
const SEGREDO = base32(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("base32 vai e volta", () => {
    expect(SEGREDO).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(deBase32(SEGREDO).toString()).toBe("12345678901234567890");
  });

  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("em t=%i o código é %s", (t, codigo) => {
    expect(codigoNoPasso(SEGREDO, Math.floor(t / 30))).toBe(codigo);
  });

  it("aceita um passo de folga e recusa o código já usado", () => {
    const agora = 1111111109 * 1000;
    const p = conferirCodigo(SEGREDO, "081 804", null, agora);
    expect(p).toBe(Math.floor(1111111109 / 30));
    expect(conferirCodigo(SEGREDO, "081804", p, agora)).toBeNull();
    expect(conferirCodigo(SEGREDO, "000000", null, agora)).toBeNull();
    expect(conferirCodigo(SEGREDO, "12345", null, agora)).toBeNull();
  });

  it("cifra e decifra o segredo; adulterado não abre", () => {
    const c = cifrar(SEGREDO);
    expect(decifrar(c)).toBe(SEGREDO);
    c[c.length - 1] ^= 1;
    expect(() => decifrar(c)).toThrow();
  });

  it("códigos de recuperação: dez, distintos, conferidos sem caixa nem hífen", () => {
    const cs = novosCodigosRecuperacao();
    expect(new Set(cs).size).toBe(10);
    expect(cs[0]).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    expect(hashCodigoRecuperacao(cs[0].toLowerCase().replace("-", " "))).toBe(hashCodigoRecuperacao(cs[0]));
  });
});
