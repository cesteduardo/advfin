import { describe, expect, it } from "vitest";
// @ts-expect-error módulo .mjs sem tipos, usado pelo script de ingestão
import { artigos, decodificar, textoLimpo } from "../../../scripts/planalto.mjs";

const html = `<html><head><meta charset="windows-1252"><style>p{}</style></head><body>
<p>Art. 1&ordm; Ficam institu&iacute;dos: I - o IBS; II - a CBS.</p>
<p><strike>Art. 2&ordm; Texto antigo revogado.</strike></p>
<p>Art. 2&ordm; Texto novo do artigo. (Reda&ccedil;&atilde;o dada pela Lei n&ordm; 1, de 2025)</p>
<p>&sect; 1&ordm; Par&aacute;grafo do artigo 2.</p>
<p>Art. 156-A. Lei complementar instituir&aacute; imposto.</p>
<p>Art. 12. Este artigo tem dois d&iacute;gitos.</p>
</body></html>`;

describe("leitura do Planalto", () => {
  it("remove redação tachada e notas de alteração e separa artigos", () => {
    const lista = artigos(textoLimpo(html));
    expect(lista.map((a: any) => a.rotulo)).toEqual(["art. 1º", "art. 2º", "art. 156-A", "art. 12"]);
    expect(lista[1].texto).toBe("Texto novo do artigo. § 1º Parágrafo do artigo 2.");
    expect(lista.some((a: any) => a.texto.includes("revogado"))).toBe(false);
  });

  it("decodifica windows-1252", () => {
    const bytes = new Uint8Array([0x3c, 0x6d, 0x65, 0x74, 0x61, 0x20, 0x63, 0x68, 0x61, 0x72, 0x73, 0x65, 0x74, 0x3d, 0x22, 0x77, 0x69, 0x6e, 0x64, 0x6f, 0x77, 0x73, 0x2d, 0x31, 0x32, 0x35, 0x32, 0x22, 0x3e, 0xe7, 0xe3, 0xba]);
    expect(decodificar(bytes)).toMatch(/çãº$/);
  });
});

// Estrutura da EC 132/2023 no Planalto: art. 1º reescreve a Constituição, art. 2º acrescenta
// artigos ao ADCT, e os artigos próprios da emenda vêm depois, sem aspas.
const ec = `<html><body>
<p>Art. 1&ordm; A Constitui&ccedil;&atilde;o Federal passa a vigorar com as seguintes altera&ccedil;&otilde;es:</p>
<p>&ldquo;Art. 156-A. Lei complementar instituir&aacute; imposto sobre bens e servi&ccedil;os de compet&ecirc;ncia compartilhada.</p>
<p>&sect; 1&ordm; O imposto observar&aacute; o seguinte: ....................................&rdquo; (NR)</p>
<p>Art. 2&ordm; O Ato das Disposi&ccedil;&otilde;es Constitucionais Transit&oacute;rias passa a vigorar acrescido dos seguintes arts. 125 a 133:</p>
<p>&ldquo;Art. 125. Em 2026, o imposto previsto no art. 156-A ser&aacute; cobrado &agrave; al&iacute;quota estadual de 0,1% (um d&eacute;cimo por cento).</p>
<p>&ldquo;Art. 129. Ficam extintos, a partir de 2033, os impostos previstos nos arts. 155, II, e 156, III.&rdquo;</p>
<p>Art. 3&ordm; A Lei Complementar n&ordm; 87, de 13 de setembro de 1996, passa a vigorar com as seguintes altera&ccedil;&otilde;es:</p>
<p>&ldquo;Art. 12. Texto novo do artigo da lei antiga.&rdquo; (NR)</p>
<p>Art. 9&ordm; A lei complementar poder&aacute; prever regimes diferenciados. (Reda&ccedil;&atilde;o dada pela Lei Complementar n&ordm; 227, de 2026)</p>
<p>Art. 23. Esta Emenda Constitucional entra em vigor na data de sua publica&ccedil;&atilde;o.</p>
</body></html>`;

describe("alterações em outras normas", () => {
  it("dá ao artigo entre aspas o prefixo da norma alterada", async () => {
    // @ts-expect-error módulo .mjs sem tipos
    const { artigos: art, textoLimpo: limpo, artigoDeVigencia } = await import("../../../scripts/planalto.mjs");
    const lista = art(limpo(ec, { manterNotas: true }));
    expect(lista.map((a: any) => a.rotulo)).toEqual([
      "art. 1º",
      "CF, art. 156-A",
      "art. 2º",
      "ADCT, art. 125",
      "ADCT, art. 129",
      "art. 3º",
      "LC 87/1996, art. 12",
      "art. 9º",
      "art. 23",
    ]);
    const adct129 = lista.find((a: any) => a.rotulo === "ADCT, art. 129");
    expect(adct129.texto).toBe("Ficam extintos, a partir de 2033, os impostos previstos nos arts. 155, II, e 156, III.");
    const art9 = lista.find((a: any) => a.rotulo === "art. 9º");
    expect(art9.texto).toBe("A lei complementar poderá prever regimes diferenciados.");
    expect(art9.notas).toEqual(["(Redação dada pela Lei Complementar nº 227, de 2026)"]);
    expect(lista.find((a: any) => a.rotulo === "CF, art. 156-A").texto).not.toMatch(/\(NR\)|”$/);
    expect(artigoDeVigencia(lista).rotulo).toBe("art. 23");
  });
});
