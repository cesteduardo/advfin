/**
 * Fase 2: login, sessões, pesquisa na base e simulações.
 * Mesmo requisito dos testes de isolamento: TEST_DATABASE_ADMIN_URL com superusuário.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expandirPergunta, selecionarFontes } from "../../src/lib/pesquisa/termos";
import { paraTrecho } from "../../src/lib/pesquisa/trecho";

const ADMIN = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:5433/postgres";
const DB = `advfin_app_${process.pid}`;
let admin: Client;
let db: Client;

async function comoApp<T>(fn: () => Promise<T>, esc = "", usu = ""): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role app_user");
    await db.query("select set_config('app.escritorio_id', $1, true), set_config('app.usuario_id', $2, true)", [esc, usu]);
    return await fn();
  } finally {
    await db.query("rollback");
  }
}

/** Como app_user, mas confirmando (para encadear cadastro → login). */
async function comoAppConfirmado<T>(fn: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role app_user");
    const r = await fn();
    await db.query("commit");
    return r;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

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
  for (const f of ["001_init.sql", "002_app.sql", "003_perfis.sql", "004_teste_publico.sql"]) await db.query(readFileSync(join(__dirname, "../migrations", f), "utf8"));
  await db.query(readFileSync(join(__dirname, "../seeds/semente_reforma.sql"), "utf8"));
});

afterAll(async () => {
  await db?.end();
  await admin?.query(`drop database if exists ${DB}`);
  await admin?.end();
});

describe("cadastro, login e sessão", () => {
  let ana: { usuario_id: string; escritorio_id: string };
  let bruno: { usuario_id: string; escritorio_id: string };

  it("app_user cadastra e cria escritório com o Titular", async () => {
    ana = await comoAppConfirmado(async () => (await db.query(`select * from app.cadastrar('Ana@A.adv.br', 'Ana', 'scrypt$hash', 'Escritório A')`)).rows[0]);
    bruno = await comoAppConfirmado(async () => (await db.query(`select * from app.cadastrar('bruno@b.adv.br', 'Bruno', 'scrypt$h2', 'Escritório B')`)).rows[0]);
    expect(ana.usuario_id).toBeTruthy();
    const { rows } = await db.query(`select nivel from membros where usuario_id = $1`, [ana.usuario_id]);
    expect(rows[0].nivel).toBe("titular");
  });

  it("e-mail repetido é recusado, sem distinção de caixa", async () => {
    await expect(comoApp(() => db.query(`select * from app.cadastrar('ana@a.adv.br', 'X', 'h', 'Y')`))).rejects.toThrow(/email_em_uso/);
  });

  it("credenciais devolvem hash e escritório; e-mail inexistente devolve vazio", async () => {
    const r = await comoApp(async () => (await db.query(`select * from app.credenciais('ANA@a.adv.br')`)).rows);
    expect(r[0]).toMatchObject({ usuario_id: ana.usuario_id, senha_hash: "scrypt$hash", escritorio_id: ana.escritorio_id, totp_ativo: false });
    expect(await comoApp(async () => (await db.query(`select * from app.credenciais('ninguem@x.com')`)).rows)).toEqual([]);
  });

  it("não abre sessão em escritório de que o usuário não é membro", async () => {
    await expect(
      comoApp(() => db.query(`select app.criar_sessao('tok-x', $1, $2, 1)`, [ana.usuario_id, bruno.escritorio_id])),
    ).rejects.toThrow(/sem_vinculo/);
  });

  it("sessão resolve, expira e encerra", async () => {
    await comoAppConfirmado(() => db.query(`select app.criar_sessao('tok-ana', $1, $2, 14)`, [ana.usuario_id, ana.escritorio_id]));
    const s = await comoApp(async () => (await db.query(`select * from app.resolver_sessao('tok-ana')`)).rows[0]);
    expect(s).toMatchObject({ nome: "Ana", escritorio: "Escritório A", nivel: "titular" });
    await db.query(`update sessoes set expira_em = now() - interval '1 second' where token_hash = 'tok-ana'`);
    expect(await comoApp(async () => (await db.query(`select * from app.resolver_sessao('tok-ana')`)).rows)).toEqual([]);
    await comoAppConfirmado(() => db.query(`select app.encerrar_sessao('tok-ana')`));
    expect((await db.query(`select 1 from sessoes where token_hash = 'tok-ana'`)).rowCount).toBe(0);
  });

  it("app_user não lê usuarios nem sessoes diretamente", async () => {
    await expect(comoApp(() => db.query(`select senha_hash from usuarios`))).rejects.toThrow(/permission denied/);
    await expect(comoApp(() => db.query(`select * from sessoes`))).rejects.toThrow(/permission denied/);
  });

  it("simulações ficam isoladas por escritório", async () => {
    await comoApp(
      async () => {
        await db.query(
          `insert into simulacoes (escritorio_id, usuario_id, tipo, titulo, entrada, resultado) values ($1, $2, 'apuracao', 'Cliente X', '{}', '{}')`,
          [ana.escritorio_id, ana.usuario_id],
        );
        expect((await db.query(`select * from simulacoes`)).rowCount).toBe(1);
      },
      ana.escritorio_id,
      ana.usuario_id,
    );
    await expect(
      comoApp(
        () =>
          db.query(`insert into simulacoes (escritorio_id, usuario_id, tipo, titulo, entrada, resultado) values ($1, $2, 'apuracao', 'X', '{}', '{}')`, [
            ana.escritorio_id,
            bruno.usuario_id,
          ]),
        bruno.escritorio_id,
        bruno.usuario_id,
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("pesquisa na base normativa", () => {
  it("acha a regra de 2026 e respeita a vigência", async () => {
    // Como a aplicação faz (src/lib/pesquisa): pergunta expandida (CBS vira "195"), busca e
    // seleção pela aderência à pergunta.
    const pergunta = "alíquota da CBS em 2026";
    const linhas = await comoApp(async () => (await db.query(`select * from pesquisar_dispositivos($1, '2026-06-01', 5, true)`, [expandirPergunta(pergunta)])).rows);
    expect(selecionarFontes(pergunta, linhas.map(paraTrecho))[0].rotulo).toBe("ADCT, art. 125, caput");
    const antes = await comoApp(async () => (await db.query(`select rotulo from pesquisar_dispositivos('Imposto Seletivo', '2024-06-01', 5, true)`)).rows);
    expect(antes.map((x) => x.rotulo)).not.toContain("art. 1º"); // LC 214 só vale a partir de 2025
  });

  it("sem a chave de não revisados, a semente não aparece", async () => {
    const r = await comoApp(async () => (await db.query(`select * from pesquisar_dispositivos('alíquota da CBS em 2026', '2026-06-01', 5, false)`)).rows);
    expect(r).toEqual([]);
  });

  it("publicado pelo curador aparece em produção; rejeitado nunca", async () => {
    await db.query(`update dispositivos set status_curadoria = 'publicado' where rotulo = 'ADCT, art. 129'`);
    await db.query(`update dispositivos set status_curadoria = 'rejeitado' where rotulo = 'ADCT, art. 128'`);
    const pub = await comoApp(async () => (await db.query(`select rotulo from pesquisar_dispositivos('extintos a partir de 2033', '2026-06-01', 5, false)`)).rows);
    expect(pub.map((x) => x.rotulo)).toEqual(["ADCT, art. 129"]);
    const todos = await comoApp(async () => (await db.query(`select rotulo from pesquisar_dispositivos('alíquotas 2029 2032 proporções', '2026-06-01', 10, true)`)).rows);
    expect(todos.map((x) => x.rotulo)).not.toContain("ADCT, art. 128");
  });
});
