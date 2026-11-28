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

  it("tira do último artigo o fecho, o índice e os títulos colados; lê &#150; como travessão", () => {
    const pagina = `<p>Art. 1º Texto um. § 1º (VETADO). CAPÍTULO V Exclusão de Crédito Tributário Seção I Disposições Gerais</p>
<p>Art. 2º Fim. Brasília, 10 de janeiro de 2002; 181º da Independência. FHC Este texto não substitui ÍNDICE PARTE GERAL</p>
<p>Art. 3º <a>(Revogado pela Lei nº 15.040, de 2024)</a> <a>Vigência</a></p><p>Art. 4º I &#150; pelo despacho</p>`;
    const lista = artigos(textoLimpo(pagina, { manterNotas: true }));
    expect(lista.map((a: any) => [a.rotulo, a.texto])).toEqual([
      ["art. 1º", "Texto um. § 1º (VETADO)."],
      ["art. 2º", "Fim."],
      ["art. 4º", "I – pelo despacho"],
    ]);
  });

  it("tira a redação tachada por estilo (inline ou classe do <style>)", () => {
    const pagina = `<html><head><style>span.msoDel {text-decoration:line-through}</style></head><body>
<p>Art. 12. Texto. § 2º Hipóteses: <span style="color:black; text-decoration:line-through"><span>I - redação antiga;</span></span> (Redação dada pela Lei nº 1, de 2011).</p>
<p>I - redação nova; <span class="msoDel">II - outra antiga;</span> II - outra nova.</p></body></html>`;
    const [a] = artigos(textoLimpo(pagina));
    expect(a.texto).toBe("Texto. § 2º Hipóteses: I - redação nova; II - outra nova.");
  });

  it("reconhece nota quebrada em duas linhas e descarta artigo que só tinha a nota", () => {
    const pagina = `<p>Art. 1º Texto do credor. (Redação \r\n dada pela Lei nº 12.431, de 2011). § 2º Outro.</p><p>Art. 2º (Revogado pela Lei nº 9.528, de 1997).</p>`;
    const lista = artigos(textoLimpo(pagina, { manterNotas: true }));
    expect(lista.map((a: any) => [a.rotulo, a.texto])).toEqual([["art. 1º", "Texto do credor. § 2º Outro."]]);
  });

  it("sem charset declarado: UTF-8 válido fica UTF-8, o resto é lido como windows-1252", () => {
    expect(decodificar(new TextEncoder().encode("<p>Art. 1º Fica instituída"))).toBe("<p>Art. 1º Fica instituída");
    const antigo = new Uint8Array([0x41, 0x72, 0x74, 0x2e, 0x20, 0x31, 0xba, 0x20, 0x69, 0x6e, 0x73, 0x74, 0x69, 0x74, 0x75, 0xed, 0x64, 0x61]);
    expect(decodificar(antigo)).toBe("Art. 1º instituída");
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

describe("vade-mécum: formatos além da EC", () => {
  it("lê 'Artigo 1º' (leis paulistas) como art. 1º", async () => {
    // @ts-expect-error módulo .mjs sem tipos
    const { artigos: art, textoLimpo: limpo } = await import("../../../scripts/planalto.mjs");
    const lista = art(limpo("<p>Artigo 1º - Fica instituído o ICMS.</p><p>Artigo 2º - Ocorre o fato gerador do imposto.</p>"));
    expect(lista.map((a: any) => a.rotulo)).toEqual(["art. 1º", "art. 2º"]);
    expect(lista[0].texto).toBe("Fica instituído o ICMS.");
  });

  it("recorta a Constituição: só os arts. 145 a 162, antes do ADCT", async () => {
    // @ts-expect-error módulo .mjs sem tipos
    const { lerNorma } = await import("../../../scripts/ingestao.mjs");
    const cf = `<p>Art. 5º Todos são iguais perante a lei.</p>
<p>Art. 145. A União, os Estados, o Distrito Federal e os Municípios poderão instituir tributos.</p>
<p>Art. 156-A. Lei complementar instituirá imposto sobre bens e serviços.</p>
<p>Art. 163. Lei complementar disporá sobre finanças públicas.</p>
<p>ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS</p>
<p>Art. 150. Artigo do ADCT com número na faixa, que não pode entrar.</p>`;
    const { lista, vigencia } = lerNorma(cf, { recorte: { ate: "ATO DAS DISPOSI[CÇ][OÕ]ES CONSTITUCIONAIS TRANSIT[OÓ]RIAS", artigos: [145, 162] } });
    expect(lista.map((a: any) => a.rotulo)).toEqual(["art. 145", "art. 156-A"]);
    expect(vigencia).toBeNull();
  });

  it("guarda a solução de consulta pela ementa", async () => {
    // @ts-expect-error módulo .mjs sem tipos
    const { lerNorma } = await import("../../../scripts/ingestao.mjs");
    const sc = `<p>Solução de Consulta nº 99 - Cosit</p><p>Assunto: Contribuição para o PIS/Pasep</p>
<p>EMENTA: CRÉDITOS. INSUMOS. Os gastos com frete na aquisição de insumos geram crédito.</p>
<p>Dispositivos Legais: Lei nº 10.637, de 2002, art. 3º.</p><p>Relatório</p><p>O consulente pergunta…</p>`;
    const { lista } = lerNorma(sc, { modo: "documento" });
    expect(lista).toHaveLength(1);
    expect(lista[0].rotulo).toBe("ementa");
    expect(lista[0].texto).toMatch(/frete na aquisição de insumos/);
    expect(lista[0].texto).not.toMatch(/Dispositivos Legais|consulente/);
  });

  it("reconhece o nome dos arquivos de soluções de consulta", async () => {
    // @ts-expect-error módulo .mjs sem tipos
    const { metaDaSolucao } = await import("../../../scripts/carregar-base.mjs");
    expect(metaDaSolucao("sc-cosit-99-2023.html")).toMatchObject({ tipo: "SOLUCAO_CONSULTA", numero: "COSIT-99", ano: "2023", modo: "documento", apelido: "Solução de Consulta COSIT 99/2023" });
    expect(metaDaSolucao("qualquer.html")).toBeNull();
  });

  it("o catálogo tem identificação única e fonte para cada norma", async () => {
    // @ts-expect-error módulo .mjs sem tipos
    const { CATALOGO, GRUPOS } = await import("../../../scripts/catalogo-normas.mjs");
    const chaves = CATALOGO.map((n: any) => `${n.tipo}|${n.numero}|${n.ano}|${n.ente ?? "BR"}`);
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(new Set(CATALOGO.map((n: any) => n.arquivo)).size).toBe(CATALOGO.length);
    for (const n of CATALOGO) {
      expect(GRUPOS[n.grupo]).toBeTruthy();
      expect(n.url || n.portal).toBeTruthy();
      expect(n.publicada).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
