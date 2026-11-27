/**
 * Migração 004: aceite dos termos, limites de uso, registro de erros, relatos de citação
 * e aposentadoria da semente. Mesmo requisito dos outros testes: TEST_DATABASE_ADMIN_URL.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:5433/postgres";
const DB = `advfin_tp_${process.pid}`;
let admin: Client;
let db: Client;

async function como<T>(esc: string, usu: string, fn: () => Promise<T>, confirmar = false): Promise<T> {
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

let ana: { usuario_id: string; escritorio_id: string };
let bruno: { usuario_id: string; escritorio_id: string };
let curador: { usuario_id: string; escritorio_id: string };
let dispositivo: string;

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
  for (const f of ["001_init.sql", "002_app.sql", "003_perfis.sql", "004_teste_publico.sql", "005_base_ampliada.sql"]) {
    await db.query(readFileSync(join(__dirname, "../migrations", f), "utf8"));
  }
  await db.query(readFileSync(join(__dirname, "../seeds/semente_reforma.sql"), "utf8"));
  const cad = async (email: string, esc: string) =>
    (await como("", "", async () => (await db.query(`select * from app.cadastrar($1, 'X', 'h', $2)`, [email, esc])).rows[0], true)) as typeof ana;
  ana = await cad("ana@a.adv.br", "A");
  bruno = await cad("bruno@b.adv.br", "B");
  curador = await cad("cura@advfin.com.br", "Curadoria");
  await db.query(`insert into equipe_plataforma (usuario_id, papel) values ($1, 'curador')`, [curador.usuario_id]);
  dispositivo = (await db.query(`select id from dispositivos where rotulo = 'ADCT, art. 125, caput'`)).rows[0].id;
});

afterAll(async () => {
  await db?.end();
  await admin?.query(`drop database if exists ${DB}`);
  await admin?.end();
});

const consulta = (quem: typeof ana, status = "respondida", quando = "now()") =>
  db.query(
    `insert into consultas (escritorio_id, usuario_id, pergunta, status, criado_em) values ($1, $2, 'p', $3, ${quando}) returning id`,
    [quem.escritorio_id, quem.usuario_id, status],
  );

describe("aceite dos termos", () => {
  it("grava a versão para a pessoa da sessão e responde se aceitou", async () => {
    await como(ana.escritorio_id, ana.usuario_id, () => db.query(`select app.registrar_aceite('2026-11-27')`), true);
    await como(ana.escritorio_id, ana.usuario_id, () => db.query(`select app.registrar_aceite('2026-11-27')`), true); // idempotente
    expect(await como(ana.escritorio_id, ana.usuario_id, async () => (await db.query(`select app.aceitou('2026-11-27') a`)).rows[0].a)).toBe(true);
    expect(await como(bruno.escritorio_id, bruno.usuario_id, async () => (await db.query(`select app.aceitou('2026-11-27') a`)).rows[0].a)).toBe(false);
    const { rows } = await db.query(`select count(*)::int n from aceites_termos`);
    expect(rows[0].n).toBe(1);
  });

  it("app_user não lê a tabela diretamente", async () => {
    const r = await como(ana.escritorio_id, ana.usuario_id, async () => (await db.query(`select * from aceites_termos`).catch((e) => ({ rows: [e.message] }))).rows);
    expect(String(r[0] ?? "")).toMatch(/permission denied|^$/);
  });
});

describe("limites de uso", () => {
  const cota = (quem: typeof ana, dia = 3, mes = 10, esc = 20, minuto = 100) =>
    como(quem.escritorio_id, quem.usuario_id, async () => (await db.query(`select * from app.cota_pesquisa($1, $2, $3, $4)`, [dia, mes, esc, minuto])).rows[0]);

  it("permite até o limite diário e para depois", async () => {
    expect(await cota(ana)).toMatchObject({ permitido: true, usadas_dia: 0, limite_dia: 3 });
    for (let i = 0; i < 3; i++) await consulta(ana);
    expect(await cota(ana)).toMatchObject({ permitido: false, motivo: "dia", usadas_dia: 3 });
  });

  it("erro do servidor não conta", async () => {
    await consulta(bruno, "erro");
    expect(await cota(bruno)).toMatchObject({ permitido: true, usadas_dia: 0 });
  });

  it("rajada por minuto e cota do escritório", async () => {
    expect(await cota(ana, 99, 99, 99, 2)).toMatchObject({ permitido: false, motivo: "minuto" });
    expect(await cota(ana, 99, 99, 3, 99)).toMatchObject({ permitido: false, motivo: "escritorio" });
  });

  it("exceção da plataforma vale só para aquele escritório", async () => {
    await db.query(`insert into equipe_plataforma (usuario_id, papel) values ($1, 'suporte')`, [bruno.usuario_id]);
    await como("", bruno.usuario_id, () => db.query(`select app.plat_definir_limite($1, 50, null, null, 'fundador')`, [ana.escritorio_id]), true);
    expect(await cota(ana)).toMatchObject({ permitido: true, limite_dia: 50 });
    expect(await cota(bruno)).toMatchObject({ limite_dia: 3 });
    const lista = await como("", bruno.usuario_id, async () => (await db.query(`select * from app.plat_limites()`)).rows);
    expect(lista[0]).toMatchObject({ escritorio: "A", consultas_dia_pessoa: 50, nota: "fundador" });
    await como("", bruno.usuario_id, () => db.query(`select app.plat_definir_limite($1, null, null, null, null)`, [ana.escritorio_id]), true);
    expect(await cota(ana)).toMatchObject({ limite_dia: 3 });
    await db.query(`delete from equipe_plataforma where usuario_id = $1`, [bruno.usuario_id]);
  });

  it("quem não é da plataforma não mexe em limite", async () => {
    await expect(como("", ana.usuario_id, () => db.query(`select app.plat_definir_limite($1, 999, 999, 999, null)`, [ana.escritorio_id]))).rejects.toThrow(/sem_permissao/);
  });

  it("sem sessão, recusa", async () => {
    await expect(como(ana.escritorio_id, bruno.usuario_id, () => db.query(`select * from app.cota_pesquisa(1,1,1,1)`))).rejects.toThrow(/sem_permissao/);
  });
});

describe("registro de erros", () => {
  it("grava com usuário e escritório da sessão e só a plataforma lê", async () => {
    await como(ana.escritorio_id, ana.usuario_id, () => db.query(`select app.registrar_erro('pesquisa', 'timeout', '/app/pesquisa', 'E1', '{"consulta":"x"}')`), true);
    await como("", "", () => db.query(`select app.registrar_erro('servidor', $1, null, null, null)`, ["x".repeat(5000)]), true);
    const { rows } = await db.query(`select * from registro_erros order by id`);
    expect(rows[0]).toMatchObject({ origem: "pesquisa", usuario_id: ana.usuario_id, escritorio_id: ana.escritorio_id });
    expect(rows[1].mensagem.length).toBe(1000);
    expect(rows[1].usuario_id).toBeNull();
    await expect(como(ana.escritorio_id, ana.usuario_id, () => db.query(`select * from app.plat_erros(7)`))).rejects.toThrow(/sem_permissao/);
    await expect(como(ana.escritorio_id, ana.usuario_id, () => db.query(`select * from registro_erros`))).rejects.toThrow(/permission denied/);
  });
});

describe("relato de citação", () => {
  let consultaAna: string;
  let relato: string;

  it("o advogado relata; outro escritório não usa a consulta alheia", async () => {
    consultaAna = (await consulta(ana)).rows[0].id;
    relato = await como(ana.escritorio_id, ana.usuario_id, async () =>
      (await db.query(`select app.relatar_citacao($1, $2, 'trecho', 'texto_diferente', 'vírgula a mais') r`, [consultaAna, dispositivo])).rows[0].r, true);
    expect(relato).toBeTruthy();
    await expect(
      como(bruno.escritorio_id, bruno.usuario_id, () => db.query(`select app.relatar_citacao($1, $2, 't', 'outro', null)`, [consultaAna, dispositivo])),
    ).rejects.toThrow(/consulta_invalida/);
    await expect(
      como(ana.escritorio_id, ana.usuario_id, () => db.query(`select app.relatar_citacao($1, $2, 't', 'inventado', null)`, [consultaAna, dispositivo])),
    ).rejects.toThrow(/check constraint/);
  });

  it("o escritório vê só os próprios relatos", async () => {
    const a = await como(ana.escritorio_id, ana.usuario_id, async () => (await db.query(`select id from relatos_citacao`)).rows);
    const b = await como(bruno.escritorio_id, bruno.usuario_id, async () => (await db.query(`select id from relatos_citacao`)).rows);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0);
  });

  it("o curador vê a fila sem a pergunta e, se procedente, tira o dispositivo da pesquisa", async () => {
    const fila = await como("", curador.usuario_id, async () => (await db.query(`select * from app.plat_relatos()`)).rows);
    expect(fila[0]).toMatchObject({ id: relato, motivo: "texto_diferente", rotulo: "ADCT, art. 125, caput", repeticoes: 1 });
    expect(Object.keys(fila[0])).not.toContain("pergunta");
    await db.query(`update dispositivos set status_curadoria = 'publicado' where id = $1`, [dispositivo]);
    await como("", curador.usuario_id, () => db.query(`select app.plat_relato_decidir($1, 'procedente', 'conferir vírgula', true)`, [relato]), true);
    const { rows } = await db.query(`select status_curadoria, nota_curadoria from dispositivos where id = $1`, [dispositivo]);
    expect(rows[0]).toEqual({ status_curadoria: "em_revisao", nota_curadoria: "conferir vírgula" });
    await expect(como("", ana.usuario_id, () => db.query(`select * from app.plat_relatos()`))).rejects.toThrow(/sem_permissao/);
  });
});

describe("semente aposentada pelo texto oficial", () => {
  it("o artigo ingerido cobre caput e parágrafos da semente", async () => {
    const ec = (await db.query(`select id from normas where tipo = 'EC' and numero = '132'`)).rows[0].id;
    await db.query(
      `insert into dispositivos (norma_id, rotulo, texto, vigencia_inicio, status_curadoria, origem)
       values ($1, 'ADCT, art. 125', 'Em 2026, o imposto previsto no art. 156-A ...', '2023-12-21', 'em_revisao', 'ingestao')`,
      [ec],
    );
    const { rows } = await db.query(`select app.aposentar_semente($1) n`, [ec]);
    expect(rows[0].n).toBe(2); // caput e § 1º
    const restantes = (await db.query(`select rotulo from dispositivos where norma_id = $1 and origem = 'semente' and status_curadoria <> 'rejeitado' order by rotulo`, [ec])).rows.map((r) => r.rotulo);
    expect(restantes).not.toContain("ADCT, art. 125, caput");
    expect(restantes).toContain("ADCT, art. 126");
    const busca = (await db.query(`select rotulo, origem from pesquisar_dispositivos('2026 alíquota 0,9%', '2026-06-01', 10, true)`)).rows;
    expect(busca.filter((b) => b.origem === "semente").map((b) => b.rotulo)).not.toContain("ADCT, art. 125, caput");
  });
});
