import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { _limparCache, escolherPartes, recuperarAmpliada, type IndiceAmpliado } from "./base-ampliada";

// @ts-expect-error módulo .mjs sem tipos
const gerador = () => import("../../../scripts/gerar-base-estatica.mjs");
// @ts-expect-error módulo .mjs sem tipos
const ingestao = () => import("../../../scripts/ingestao.mjs");

const CODIGO_CIVIL = `<html><body>
<p>Art. 1º Toda pessoa é capaz de direitos e deveres na ordem civil.</p>
<p>Art. 50. Em caso de abuso da personalidade jurídica, caracterizado pelo desvio de finalidade ou pela confusão patrimonial, pode o juiz, a requerimento da parte, desconsiderá-la.
<strike>Art. 50. Redação antiga que não pode entrar.</strike> (Redação dada pela Lei nº 13.874, de 2019)</p>
<p>Art. 2.046. Todas as remissões, em diplomas legislativos, aos Códigos referidos no artigo antecedente, consideram-se feitas às disposições correspondentes deste Código.</p>
</body></html>`;

async function gerarEm(pasta: string) {
  const { lerNorma } = await ingestao();
  const { montarNorma, reconstruirIndice, idDaNorma } = await gerador();
  const meta = { grupo: "apoio", tipo: "LEI", numero: "10406", ano: "2002", publicada: "2002-01-11", apelido: "Código Civil", ementa: "Institui o Código Civil.", url: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm" };
  const { lista } = lerNorma(CODIGO_CIVIL, meta);
  const { id, dispositivos, partes } = montarNorma(meta, lista);
  expect(id).toBe(idDaNorma(meta));
  for (const [i, p] of partes.entries()) await writeFile(join(pasta, `${id}-${i + 1}.json`), JSON.stringify({ norma: id, dispositivos: p }));
  await writeFile(join(pasta, "normas.json"), JSON.stringify([{ id, norma: "Código Civil", ementa: meta.ementa, url: meta.url, grupo: "apoio", vigenciaInicio: meta.publicada, dispositivos: dispositivos.length, partes: partes.length }]));
  return reconstruirIndice(pasta) as Promise<IndiceAmpliado>;
}

/** fetch que serve a pasta gerada, como o GitHub Pages serviria /base. */
const servir = (pasta: string) =>
  (async (url: string) => {
    const nome = String(url).split("/base/")[1];
    try {
      const corpo = await readFile(join(pasta, nome), "utf8");
      return new Response(corpo, { status: 200 });
    } catch {
      return new Response("", { status: 404 });
    }
  }) as unknown as typeof fetch;

afterEach(() => _limparCache());

describe("base ampliada da demonstração", () => {
  it("guarda o texto literal, sem a redação tachada e com a nota à parte", async () => {
    const pasta = await mkdtemp(join(tmpdir(), "advfin-base-"));
    await gerarEm(pasta);
    const parte = JSON.parse(await readFile(join(pasta, "lei-10406-2002-1.json"), "utf8"));
    const art50 = parte.dispositivos.find((d: { rotulo: string }) => d.rotulo === "art. 50");
    expect(art50.texto).toBe(
      "Em caso de abuso da personalidade jurídica, caracterizado pelo desvio de finalidade ou pela confusão patrimonial, pode o juiz, a requerimento da parte, desconsiderá-la.",
    );
    expect(art50.notas).toEqual(["(Redação dada pela Lei nº 13.874, de 2019)"]);
    expect(parte.dispositivos.map((d: { rotulo: string }) => d.rotulo)).toEqual(["art. 1º", "art. 50", "art. 2.046"]);
  });

  it("baixa só a parte que tem os termos e cita como não conferido", async () => {
    const pasta = await mkdtemp(join(tmpdir(), "advfin-base-"));
    const ix = await gerarEm(pasta);
    expect(escolherPartes(ix, "desconsideração da personalidade jurídica")).toEqual([0]);
    const r = await recuperarAmpliada("desconsideração da personalidade jurídica por confusão patrimonial", "2026-11-28", 6, servir(pasta));
    expect(r[0]).toMatchObject({ norma: "Código Civil", rotulo: "art. 50", curadoria: "em_revisao", origem: "ingestao", ref: "D1" });
  });

  it("sem índice publicado, segue com a base embutida", async () => {
    const r = await recuperarAmpliada("Qual a alíquota da CBS e do IBS em 2026?", "2026-01-01", 6, (async () => new Response("", { status: 404 })) as unknown as typeof fetch);
    expect(r[0].rotulo).toBe("ADCT, art. 125, caput");
  });

  it("recorta o ADCT da Reforma pelo título em caixa alta, com prefixo", async () => {
    const { lerNorma } = await ingestao();
    const cf = `<p>Art. 156-A. Cita o Ato das Disposições Constitucionais Transitórias no meio do texto.</p>
<p>ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS</p>
<p>Art. 1º O Presidente da República prestará o compromisso.</p>
<p>Art. 125. Em 2026, o imposto será cobrado à alíquota estadual de 0,1%.</p>`;
    const { lista } = lerNorma(cf, { recorte: { desde: "ATO DAS DISPOSI[CÇ][OÕ]ES CONSTITUCIONAIS TRANSIT[OÓ]RIAS", artigos: [124, 138], prefixo: "ADCT" } });
    expect(lista.map((a: { rotulo: string }) => a.rotulo)).toEqual(["ADCT, art. 125"]);
  });
});
