/**
 * Portão de segurança: um escritório não acessa dados de outro.
 *
 * Requer um PostgreSQL acessível como superusuário em TEST_DATABASE_ADMIN_URL
 * (padrão: postgres://postgres@localhost:5433/postgres). Cria um banco
 * descartável, aplica as migrações e testa as políticas com o papel app_user.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:5433/postgres";
const DB = `advfin_rls_${process.pid}`;

let admin: Client;
let db: Client;

const ids = {
  escA: "aaaaaaaa-0000-0000-0000-000000000001",
  escB: "bbbbbbbb-0000-0000-0000-000000000002",
  ana: "aaaaaaaa-1111-0000-0000-000000000001", // sócia do A
  bruno: "bbbbbbbb-1111-0000-0000-000000000002", // sócio do B
  casoA: "aaaaaaaa-2222-0000-0000-000000000001",
  casoB: "bbbbbbbb-2222-0000-0000-000000000002",
};

/** Executa fn como app_user, no contexto (escritório, usuário). */
async function comoApp<T>(escritorio: string | null, usuario: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role app_user");
    await db.query("select set_config('app.escritorio_id', $1, true), set_config('app.usuario_id', $2, true)", [
      escritorio ?? "",
      usuario ?? "",
    ]);
    return await fn();
  } finally {
    await db.query("rollback");
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
  await db.query(readFileSync(join(__dirname, "../migrations/001_init.sql"), "utf8"));

  await db.query(
    `insert into usuarios (id, email, nome) values ($1, 'ana@a.adv.br', 'Ana'), ($2, 'bruno@b.adv.br', 'Bruno')`,
    [ids.ana, ids.bruno],
  );
  await db.query(`insert into escritorios (id, nome) values ($1, 'Escritório A'), ($2, 'Escritório B')`, [
    ids.escA,
    ids.escB,
  ]);
  await db.query(`insert into membros values ($1, $2, 'socio'), ($3, $4, 'socio')`, [
    ids.escA,
    ids.ana,
    ids.escB,
    ids.bruno,
  ]);
  await db.query(`insert into casos (id, escritorio_id, titulo) values ($1, $2, 'Caso sigiloso A'), ($3, $4, 'Caso sigiloso B')`, [
    ids.casoA,
    ids.escA,
    ids.casoB,
    ids.escB,
  ]);
  await db.query(
    `insert into consultas (escritorio_id, usuario_id, pergunta) values ($1, $2, 'pergunta A'), ($3, $4, 'pergunta B')`,
    [ids.escA, ids.ana, ids.escB, ids.bruno],
  );
  await db.query(
    `insert into documentos_privados (escritorio_id, titulo, conteudo) values ($1, 'doc A', 'x'), ($2, 'doc B', 'y')`,
    [ids.escA, ids.escB],
  );
  await db.query(`insert into auditoria (escritorio_id, usuario_id, acao) values ($1, $2, 'consulta'), ($3, $4, 'consulta')`, [
    ids.escA,
    ids.ana,
    ids.escB,
    ids.bruno,
  ]);
});

afterAll(async () => {
  await db?.end();
  await admin?.query(`drop database if exists ${DB}`);
  await admin?.end();
});

const TABELAS = ["escritorios", "membros", "casos", "consultas", "documentos_privados", "auditoria"];

describe("isolamento por escritório (RLS)", () => {
  it.each(TABELAS)("%s: Ana vê apenas linhas do escritório A", async (tabela) => {
    const linhas = await comoApp(ids.escA, ids.ana, async () => (await db.query(`select * from ${tabela}`)).rows);
    expect(linhas.length).toBeGreaterThan(0);
    for (const l of linhas) expect(l.escritorio_id ?? l.id).toBe(ids.escA);
  });

  it.each(TABELAS)("%s: sem contexto, nada é visível", async (tabela) => {
    const n = await comoApp(null, null, async () => (await db.query(`select count(*)::int n from ${tabela}`)).rows[0].n);
    expect(n).toBe(0);
  });

  it.each(TABELAS)("%s: contexto forjado (Ana declarando escritório B) não vê nada", async (tabela) => {
    const n = await comoApp(ids.escB, ids.ana, async () => (await db.query(`select count(*)::int n from ${tabela}`)).rows[0].n);
    expect(n).toBe(0);
  });

  it("busca direta pelo id de um caso de outro escritório não retorna nada", async () => {
    const r = await comoApp(ids.escA, ids.ana, () => db.query("select * from casos where id = $1", [ids.casoB]));
    expect(r.rowCount).toBe(0);
  });

  it("não é possível inserir dados no escritório alheio", async () => {
    await expect(
      comoApp(ids.escA, ids.ana, () =>
        db.query("insert into casos (escritorio_id, titulo) values ($1, 'invasão')", [ids.escB]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("não é possível mover um caso próprio para outro escritório", async () => {
    await expect(
      comoApp(ids.escA, ids.ana, () => db.query("update casos set escritorio_id = $1 where id = $2", [ids.escB, ids.casoA])),
    ).rejects.toThrow(/row-level security/);
  });

  it("update e delete em dados alheios não afetam nenhuma linha", async () => {
    const r = await comoApp(ids.escA, ids.ana, async () => {
      const u = await db.query("update casos set titulo = 'x' where id = $1", [ids.casoB]);
      const d = await db.query("delete from documentos_privados where escritorio_id = $1", [ids.escB]);
      return [u.rowCount, d.rowCount];
    });
    expect(r).toEqual([0, 0]);
  });

  it("auditoria é append-only para a aplicação", async () => {
    await expect(
      comoApp(ids.escA, ids.ana, () => db.query("delete from auditoria")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      comoApp(ids.escA, ids.ana, () => db.query("update auditoria set acao = 'x'")),
    ).rejects.toThrow(/permission denied/);
  });

  it("a aplicação não lê a tabela de usuários diretamente", async () => {
    await expect(comoApp(ids.escA, ids.ana, () => db.query("select * from usuarios"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("base normativa versionada", () => {
  beforeAll(async () => {
    const n = await db.query(
      `insert into normas (tipo, numero, ano, ementa, url_oficial, publicada_em)
       values ('LC', '214', 2025, 'Institui o IBS, a CBS e o IS', 'https://www.planalto.gov.br/', '2025-01-16') returning id`,
    );
    const norma = n.rows[0].id;
    await db.query(
      `insert into dispositivos (norma_id, rotulo, texto, vigencia_inicio, vigencia_fim, status_curadoria) values
       ($1, 'art. X', 'redação original', '2025-01-16', '2027-01-01', 'publicado'),
       ($1, 'art. X', 'redação alterada', '2027-01-01', null, 'publicado'),
       ($1, 'art. Y', 'rascunho não revisado', '2025-01-16', null, 'rascunho')`,
      [norma],
    );
  });

  const vigentes = (data: string) =>
    comoApp(ids.escA, ids.ana, async () =>
      (await db.query("select rotulo, texto from dispositivos_vigentes_em($1) order by rotulo", [data])).rows,
    );

  it("responde o que valia em 31/12/2026", async () => {
    expect(await vigentes("2026-12-31")).toEqual([{ rotulo: "art. X", texto: "redação original" }]);
  });

  it("responde o que vale em 01/01/2027", async () => {
    expect(await vigentes("2027-01-01")).toEqual([{ rotulo: "art. X", texto: "redação alterada" }]);
  });

  it("rascunhos de curadoria nunca aparecem", async () => {
    const todos = await vigentes("2030-01-01");
    expect(todos.some((d) => d.rotulo === "art. Y")).toBe(false);
  });

  it("a aplicação não grava na base normativa", async () => {
    await expect(
      comoApp(ids.escA, ids.ana, () => db.query("update normas set ementa = 'x'")),
    ).rejects.toThrow(/permission denied/);
  });
});
