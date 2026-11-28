/**
 * Notas da equipe nos casos: quem vê o caso lê e escreve; apagar, só o autor ou Admin para cima.
 * Mesmo requisito dos outros testes de banco: TEST_DATABASE_ADMIN_URL com superusuário.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:5433/postgres";
const DB = `advfin_notas_${process.pid}`;
const MIGRACOES = ["001_init.sql", "002_app.sql", "003_perfis.sql", "004_teste_publico.sql", "005_base_ampliada.sql", "006_notas_caso.sql"];
let admin: Client;
let db: Client;

const E = { A: "aaaaaaaa-0000-0000-0000-00000000000a", B: "bbbbbbbb-0000-0000-0000-00000000000b" };
const U = {
  tita: "10000000-0000-0000-0000-000000000001",
  adm1: "10000000-0000-0000-0000-000000000002",
  mem1: "10000000-0000-0000-0000-000000000004",
  sup1: "10000000-0000-0000-0000-000000000006",
  sup2: "10000000-0000-0000-0000-000000000007",
  bia: "20000000-0000-0000-0000-000000000001",
};
const NIVEL: Record<keyof typeof U, string> = { tita: "titular", adm1: "admin", mem1: "membro", sup1: "supervisionado", sup2: "supervisionado", bia: "titular" };

async function como<T = any>(esc: string, usu: string, fn: () => Promise<T>, confirmar = false): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role app_user");
    await db.query("select set_config('app.escritorio_id', $1, true), set_config('app.usuario_id', $2, true)", [esc, usu]);
    const r = await fn();
    await db.query(confirmar ? "commit" : "rollback");
    return r;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
const q = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows;
const faz = (usu: string, sql: string, p: unknown[] = [], esc = E.A) => como(esc, usu, () => q(sql, p), true);
const ve = (usu: string, sql: string, p: unknown[] = [], esc = E.A) => como(esc, usu, () => q(sql, p));

let caso = "";

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
  for (const f of MIGRACOES) await db.query(readFileSync(join(__dirname, "../migrations", f), "utf8"));
  await db.query(`insert into escritorios (id, nome) values ($1, 'Escritório A'), ($2, 'Escritório B')`, [E.A, E.B]);
  for (const [k, id] of Object.entries(U)) {
    await db.query(`insert into usuarios (id, email, nome) values ($1, $2, $3)`, [id, `${k}@${k === "bia" ? "b" : "a"}.adv.br`, k]);
    await db.query(`insert into membros (escritorio_id, usuario_id, nivel) values ($1, $2, $3)`, [k === "bia" ? E.B : E.A, id, NIVEL[k as keyof typeof U]]);
  }
  // Caso do Membro, visível a Membros para cima; o Supervisionado 1 é incluído, o 2 não.
  [{ id: caso }] = await faz(U.mem1, `insert into casos (escritorio_id, titulo) values ($1, 'caso') returning id`, [E.A]);
  await db.query(`insert into casos_membros (caso_id, usuario_id) values ($1, $2)`, [caso, U.sup1]);
});

afterAll(async () => {
  await db?.end();
  await admin?.query(`drop database if exists ${DB}`);
  await admin?.end();
});

describe("notas da equipe no caso", () => {
  it("quem vê o caso escreve; autor e escritório vêm do banco", async () => {
    await faz(U.mem1, `insert into casos_notas (caso_id, texto) values ($1, 'Pedi o contrato ao cliente.')`, [caso]);
    await faz(U.sup1, `insert into casos_notas (caso_id, texto) values ($1, 'Li as notas fiscais de março.')`, [caso]);
    const r = await q(`select autor_id, escritorio_id from casos_notas order by criado_em`);
    expect(r.map((x) => x.autor_id)).toEqual([U.mem1, U.sup1]);
    expect(new Set(r.map((x) => x.escritorio_id))).toEqual(new Set([E.A]));
  });

  it("quem não vê o caso não lê nem escreve, e outro escritório não enxerga nada", async () => {
    expect(await ve(U.sup2, `select * from casos_notas`)).toEqual([]);
    await expect(faz(U.sup2, `insert into casos_notas (caso_id, texto) values ($1, 'x')`, [caso])).rejects.toThrow(/row-level security/);
    expect(await ve(U.bia, `select * from casos_notas`, [], E.B)).toEqual([]);
  });

  it("não dá para assinar a nota como outra pessoa", async () => {
    await expect(faz(U.sup1, `insert into casos_notas (caso_id, texto, autor_id) values ($1, 'x', $2)`, [caso, U.mem1])).rejects.toThrow(/permission denied/);
  });

  it("o Supervisionado apaga só a própria nota; Admin apaga qualquer uma", async () => {
    const alheia = (await q(`select id from casos_notas where autor_id = $1`, [U.mem1]))[0].id;
    const propria = (await q(`select id from casos_notas where autor_id = $1`, [U.sup1]))[0].id;
    expect(await faz(U.sup1, `delete from casos_notas where id = $1 returning id`, [alheia])).toEqual([]);
    expect(await faz(U.sup1, `delete from casos_notas where id = $1 returning id`, [propria])).toEqual([{ id: propria }]);
    expect(await faz(U.adm1, `delete from casos_notas where id = $1 returning id`, [alheia])).toEqual([{ id: alheia }]);
  });

  it("nota vazia ou editada depois não passa", async () => {
    await expect(faz(U.mem1, `insert into casos_notas (caso_id, texto) values ($1, '   ')`, [caso])).rejects.toThrow(/check constraint/);
    await faz(U.mem1, `insert into casos_notas (caso_id, texto) values ($1, 'ok')`, [caso]);
    await expect(faz(U.mem1, `update casos_notas set texto = 'mudou'`)).rejects.toThrow(/permission denied/);
  });
});
