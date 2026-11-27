/**
 * Carga do texto oficial: fila do curador, versões e aposentadoria da semente.
 * Página de exemplo com a estrutura da EC 132 no Planalto (aspas, ADCT, notas).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error módulo .mjs sem tipos, usado pelos scripts de carga
import { ingerirNorma } from "../../scripts/ingestao.mjs";

const ADMIN = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:5433/postgres";
const DB = `advfin_ing_${process.pid}`;
let admin: Client;
let db: Client;

const META = {
  tipo: "EC", numero: "132", ano: "2023", publicada: "2023-12-21",
  ementa: "Altera o Sistema Tributário Nacional.", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm",
};
const pagina = (art125: string) => `<html><body>
<p>Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:</p>
<p>“Art. 156-A. Lei complementar instituirá imposto sobre bens e serviços de competência compartilhada entre Estados, Distrito Federal e Municípios.” (NR)</p>
<p>Art. 2º O Ato das Disposições Constitucionais Transitórias passa a vigorar acrescido dos seguintes arts. 125 a 129:</p>
<p>“Art. 125. ${art125}</p>
<p>§ 1º O montante recolhido na forma do caput será compensado com o valor devido das contribuições.</p>
<p>“Art. 129. Ficam extintos, a partir de 2033, os impostos previstos nos arts. 155, II, e 156, III, da Constituição Federal.”</p>
<p>Art. 23. Esta Emenda Constitucional entra em vigor na data de sua publicação. (Vide)</p>
</body></html>`;
const TEXTO_125 = "Em 2026, o imposto previsto no art. 156-A será cobrado à alíquota estadual de 0,1% (um décimo por cento), e a contribuição prevista no art. 195, V, será cobrada à alíquota de 0,9% (nove décimos por cento).";

beforeAll(async () => {
  admin = new Client({ connectionString: ADMIN });
  await admin.connect();
  await admin.query(`drop database if exists ${DB}`);
  await admin.query(`create database ${DB}`);
  const url = new URL(ADMIN);
  url.pathname = `/${DB}`;
  db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query("set client_min_messages = warning");
  for (const f of ["001_init.sql", "002_app.sql", "003_perfis.sql", "004_teste_publico.sql"]) {
    await db.query(readFileSync(join(__dirname, "../migrations", f), "utf8"));
  }
  await db.query(readFileSync(join(__dirname, "../seeds/semente_reforma.sql"), "utf8"));
});

afterAll(async () => {
  await db?.end();
  await admin?.query(`drop database if exists ${DB}`);
  await admin?.end();
});

describe("carga do texto oficial", () => {
  it("entra na fila do curador com rótulos de CF e ADCT e aposenta a semente coberta", async () => {
    const r = await ingerirNorma(db, META, pagina(TEXTO_125));
    expect(r).toMatchObject({ lidos: 6, introducoes: 2, novos: 4, versoesNovas: 0, vigencia: "art. 23" });
    expect(r.sementesAposentadas).toBe(3); // ADCT 125 caput, 125 § 1º e 129
    const { rows } = await db.query(
      `select rotulo, status_curadoria, nota_curadoria from dispositivos where origem = 'ingestao' order by rotulo`,
    );
    expect(new Set(rows.map((x) => x.rotulo))).toEqual(new Set(["ADCT, art. 125", "ADCT, art. 129", "art. 23", "CF, art. 156-A"]));
    expect(rows.every((x) => x.status_curadoria === "em_revisao")).toBe(true);
    const adct = rows.find((x) => x.rotulo === "ADCT, art. 125");
    expect(adct.nota_curadoria).toMatch(/insere em ADCT/);
    expect(adct.nota_curadoria).toMatch(/art\. 23/);
    const ativas = (await db.query(`select rotulo from dispositivos where origem = 'semente' and status_curadoria <> 'rejeitado'`)).rows.map((x) => x.rotulo);
    expect(ativas).toContain("ADCT, art. 126"); // não veio na página de exemplo
    expect(ativas).not.toContain("ADCT, art. 125, caput");
  });

  it("rodar de novo não duplica; redação nova vira versão nova na fila", async () => {
    const igual = await ingerirNorma(db, META, pagina(TEXTO_125));
    expect(igual).toMatchObject({ novos: 0, versoesNovas: 0, iguais: 4 });
    const mudou = await ingerirNorma(db, META, pagina(TEXTO_125.replace("0,9%", "0,8%")));
    expect(mudou).toMatchObject({ novos: 0, versoesNovas: 1, iguais: 3 });
    const { rows } = await db.query(`select nota_curadoria from dispositivos where rotulo = 'ADCT, art. 125' order by texto`);
    expect(rows).toHaveLength(2);
    expect(rows.some((x) => /fechar a vigência/.test(x.nota_curadoria))).toBe(true);
  });

  it("o texto oficial aparece na fila e na busca (beta, não revisados incluídos)", async () => {
    await db.query("set role app_user");
    try {
      const busca = (await db.query(`select rotulo, origem from pesquisar_dispositivos('alíquota 2026 0,9% 195', '2026-06-01', 5, true)`)).rows;
      expect(busca[0]).toMatchObject({ rotulo: "ADCT, art. 125", origem: "ingestao" });
    } finally {
      await db.query("reset role");
    }
  });
});
