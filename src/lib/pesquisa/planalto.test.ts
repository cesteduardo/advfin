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
