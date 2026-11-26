/**
 * Níveis de acesso, visibilidade por nível, pessoas, convites, 2FA, encerramento e plataforma.
 * Mesmo requisito dos outros testes de banco: TEST_DATABASE_ADMIN_URL com superusuário.
 * Os testes de um describe dependem da ordem: cada um parte do estado deixado pelo anterior.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:5433/postgres";
const DB = `advfin_perfis_${process.pid}`;
const MIGRACOES = ["001_init.sql", "002_app.sql", "003_perfis.sql"];
let admin: Client;
let db: Client;

const h = (s: string) => createHash("sha256").update(s).digest("hex");

/** Como app_user no contexto (escritório, usuário). Desfaz no fim, a não ser que confirmar = true. */
async function como<T = any>(esc: string | null, usu: string | null, fn: () => Promise<T>, confirmar = false): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role app_user");
    await db.query("select set_config('app.escritorio_id', $1, true), set_config('app.usuario_id', $2, true)", [esc ?? "", usu ?? ""]);
    const r = await fn();
    await db.query(confirmar ? "commit" : "rollback");
    return r;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
const q = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows;
const um = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows[0];

/** Atalho: executa sql como a pessoa, no escritório A, e confirma. */
const faz = (usu: string, sql: string, p: unknown[] = [], esc = E.A) => como(esc, usu, () => q(sql, p), true);
const ve = (usu: string, sql: string, p: unknown[] = [], esc = E.A) => como(esc, usu, () => q(sql, p));

const E = { A: "aaaaaaaa-0000-0000-0000-00000000000a", B: "bbbbbbbb-0000-0000-0000-00000000000b" };
const U = {
  tita: "10000000-0000-0000-0000-000000000001", // titular do A
  adm1: "10000000-0000-0000-0000-000000000002",
  adm2: "10000000-0000-0000-0000-000000000003",
  mem1: "10000000-0000-0000-0000-000000000004",
  mem2: "10000000-0000-0000-0000-000000000005",
  sup1: "10000000-0000-0000-0000-000000000006",
  sup2: "10000000-0000-0000-0000-000000000007",
  bia: "20000000-0000-0000-0000-000000000001", // titular do B
};
const NIVEL: Record<keyof typeof U, string> = {
  tita: "titular", adm1: "admin", adm2: "admin", mem1: "membro", mem2: "membro", sup1: "supervisionado", sup2: "supervisionado", bia: "titular",
};

async function criarBanco(migracoes: string[]) {
  admin = new Client({ connectionString: ADMIN });
  await admin.connect();
  await admin.query(`drop database if exists ${DB}`);
  await admin.query(`create database ${DB}`);
  const url = new URL(ADMIN);
  url.pathname = `/${DB}`;
  db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query("set client_min_messages = warning");
  for (const f of migracoes) await db.query(readFileSync(join(__dirname, "../migrations", f), "utf8"));
}

beforeAll(async () => {
  await criarBanco(MIGRACOES);
  await db.query(`insert into escritorios (id, nome) values ($1, 'Escritório A'), ($2, 'Escritório B')`, [E.A, E.B]);
  for (const [k, id] of Object.entries(U)) {
    await db.query(`insert into usuarios (id, email, nome) values ($1, $2, $3)`, [id, `${k}@${k === "bia" ? "b" : "a"}.adv.br`, k]);
    await db.query(`insert into membros (escritorio_id, usuario_id, nivel) values ($1, $2, $3)`, [k === "bia" ? E.B : E.A, id, NIVEL[k as keyof typeof U]]);
  }
});

afterAll(async () => {
  await db?.end();
  await admin?.query(`drop database if exists ${DB}`);
  await admin?.end();
});

describe("matriz de permissões em dados", () => {
  const pode = (usu: string, acao: string) => como(E.A, usu, async () => (await um(`select app.pode($1) p`, [acao])).p);

  it("cada nível pode exatamente o que a matriz diz", async () => {
    expect(await pode(U.sup1, "usar_ferramentas")).toBe(true);
    expect(await pode(U.sup1, "exportar_parecer")).toBe(false); // pede revisão
    expect(await como(E.A, U.sup1, async () => (await um(`select app.pede_revisao('exportar_parecer') r`)).r)).toBe(true);
    expect(await pode(U.sup1, "enviar_documentos")).toBe(false);
    expect(await pode(U.mem1, "enviar_documentos")).toBe(true);
    expect(await pode(U.mem1, "ver_auditoria")).toBe(false);
    expect(await pode(U.adm1, "gerir_pessoas")).toBe(true);
    expect(await pode(U.adm1, "gerir_cobranca")).toBe(false);
    expect(await pode(U.adm1, "encerrar_escritorio")).toBe(false);
    expect(await pode(U.tita, "encerrar_escritorio")).toBe(true);
  });

  it("no escritório alheio ninguém pode nada", async () => {
    expect(await como(E.B, U.tita, async () => (await um(`select app.pode('usar_ferramentas') p, app.nivel_atual() n`)))).toEqual({ p: false, n: null });
  });

  it("a aplicação lê a matriz, mas não a altera", async () => {
    expect((await ve(U.tita, `select count(*)::int n from app.permissoes`))[0].n).toBeGreaterThan(20);
    await expect(ve(U.tita, `insert into app.permissoes values ('gerir_cobranca', 'membro', 'pode')`)).rejects.toThrow(/permission denied/);
  });
});

describe("visibilidade por nível", () => {
  const casos: Record<string, string> = {};
  const titulos = (usu: string) => ve(usu, `select titulo from casos order by titulo`).then((r) => r.map((x) => x.titulo));

  beforeAll(async () => {
    for (const k of ["tita", "adm1", "mem1", "sup1"] as const) {
      const [c] = await faz(U[k], `insert into casos (escritorio_id, titulo, nivel_minimo) values ($1, $2, 'supervisionado') returning id, nivel_minimo`, [E.A, `caso ${k}`]);
      casos[k] = c.id;
    }
  });

  it("o nível mínimo vem do autor, com piso em Membro e teto em Admin, e a aplicação não escolhe", async () => {
    const r = await q(`select titulo, nivel_minimo from casos order by titulo`);
    expect(Object.fromEntries(r.map((x) => [x.titulo, x.nivel_minimo]))).toEqual({
      "caso adm1": "admin", "caso mem1": "membro", "caso sup1": "membro", "caso tita": "admin",
    });
    await expect(faz(U.mem1, `update casos set nivel_minimo = 'supervisionado' where id = $1`, [casos.mem1])).rejects.toThrow(/permission denied/);
  });

  it("Titular e Admins veem tudo", async () => {
    expect(await titulos(U.tita)).toEqual(["caso adm1", "caso mem1", "caso sup1", "caso tita"]);
    expect(await titulos(U.adm2)).toEqual(["caso adm1", "caso mem1", "caso sup1", "caso tita"]);
  });

  it("Membro vê os de Membros e Supervisionados; Supervisionado só os seus", async () => {
    expect(await titulos(U.mem2)).toEqual(["caso mem1", "caso sup1"]);
    expect(await titulos(U.sup1)).toEqual(["caso sup1"]);
    expect(await titulos(U.sup2)).toEqual([]);
  });

  it("incluir alguém mostra o caso a quem está abaixo", async () => {
    expect((await faz(U.mem1, `select app.incluir_no_caso($1, $2) r`, [casos.mem1, U.sup2]))[0].r).toBe("incluido");
    expect(await titulos(U.sup2)).toEqual(["caso mem1"]);
    expect((await ve(U.sup2, `select usuario_id from casos_membros`)).map((x) => x.usuario_id)).toEqual([U.sup2]);
  });

  it("Supervisionado que inclui alguém pede revisão; aprovada por um Membro, vale", async () => {
    expect((await faz(U.sup1, `select app.incluir_no_caso($1, $2) r`, [casos.sup1, U.sup2]))[0].r).toBe("revisao");
    expect(await titulos(U.sup2)).toEqual(["caso mem1"]);
    const [rev] = await ve(U.mem2, `select id, acao, status from revisoes`);
    expect(rev).toMatchObject({ acao: "incluir_colega", status: "pendente" });
    await expect(faz(U.sup2, `select app.decidir_revisao($1, true, null)`, [rev.id])).rejects.toThrow(/sem_permissao/);
    await faz(U.mem2, `select app.decidir_revisao($1, true, 'ok')`, [rev.id]);
    expect(await titulos(U.sup2)).toEqual(["caso mem1", "caso sup1"]);
  });

  it("ninguém vê o caso de nível acima só por saber o id", async () => {
    expect(await ve(U.mem1, `select * from casos where id = $1`, [casos.adm1])).toEqual([]);
    expect(await ve(U.mem1, `select app.caso_visivel($1) v`, [casos.adm1])).toEqual([{ v: false }]);
    await expect(faz(U.mem1, `select app.incluir_no_caso($1, $2)`, [casos.adm1, U.mem1])).rejects.toThrow(/caso_invalido/);
  });

  it("consultas seguem a mesma regra, fora e dentro de caso", async () => {
    for (const k of ["adm1", "mem1", "sup1", "sup2"] as const) {
      await faz(U[k], `insert into consultas (escritorio_id, usuario_id, pergunta) values ($1, $2, $3)`, [E.A, U[k], `pergunta ${k}`]);
    }
    await faz(U.adm1, `insert into consultas (escritorio_id, usuario_id, pergunta, caso_id) values ($1, $2, 'no caso do mem1', $3)`, [E.A, U.adm1, casos.mem1]);
    const perguntas = (usu: string) => ve(usu, `select pergunta from consultas order by pergunta`).then((r) => r.map((x) => x.pergunta));
    expect(await perguntas(U.adm2)).toEqual(["no caso do mem1", "pergunta adm1", "pergunta mem1", "pergunta sup1", "pergunta sup2"]);
    expect(await perguntas(U.mem2)).toEqual(["no caso do mem1", "pergunta mem1", "pergunta sup1", "pergunta sup2"]);
    // sup2 foi incluído no caso do mem1: vê a consulta feita nele, mesmo sendo de um Admin.
    expect(await perguntas(U.sup2)).toEqual(["no caso do mem1", "pergunta sup2"]);
    expect(await perguntas(U.sup1)).toEqual(["pergunta sup1"]);
  });

  it("não se grava consulta em nome de outro nem num caso invisível", async () => {
    await expect(faz(U.mem1, `insert into consultas (escritorio_id, usuario_id, pergunta) values ($1, $2, 'x')`, [E.A, U.mem2])).rejects.toThrow(/row-level security/);
    await expect(faz(U.mem1, `insert into consultas (escritorio_id, usuario_id, pergunta, caso_id) values ($1, $2, 'x', $3)`, [E.A, U.mem1, casos.adm1])).rejects.toThrow(/row-level security/);
  });

  it("simulações têm a mesma visibilidade", async () => {
    await faz(U.sup1, `insert into simulacoes (escritorio_id, usuario_id, tipo, titulo, entrada, resultado) values ($1, $2, 'apuracao', 'sim sup1', '{}', '{}')`, [E.A, U.sup1]);
    expect(await ve(U.sup2, `select * from simulacoes`)).toEqual([]);
    expect((await ve(U.mem1, `select titulo from simulacoes`)).map((x) => x.titulo)).toEqual(["sim sup1"]);
  });

  it("o parecer lê só as fontes de uma consulta visível", async () => {
    const n = await um(`insert into normas (tipo, numero, ano, ementa, url_oficial, publicada_em) values ('EC', '132', 2023, 'Reforma', 'https://www.planalto.gov.br/', '2023-12-21') returning id`);
    const d = await um(`insert into dispositivos (norma_id, rotulo, texto, vigencia_inicio, origem, status_curadoria) values ($1, 'art. 9º', 'texto citado', '2023-12-21', 'semente', 'em_revisao') returning id`, [n.id]);
    const [c] = await ve(U.adm1, `select id from consultas where pergunta = 'pergunta adm1'`);
    await db.query(`update consultas set citacoes = $2 where id = $1`, [c.id, JSON.stringify([{ ref: "D1", dispositivo_id: d.id, trecho: "texto" }])]);
    expect(await ve(U.adm2, `select rotulo, status_curadoria from app.fontes_da_consulta($1)`, [c.id])).toEqual([{ rotulo: "art. 9º", status_curadoria: "em_revisao" }]);
    expect(await ve(U.mem1, `select * from app.fontes_da_consulta($1)`, [c.id])).toEqual([]);
  });

  it("só o autor e Admins editam ou apagam o caso", async () => {
    expect(await faz(U.mem2, `update casos set titulo = 'x' where id = $1 returning id`, [casos.mem1])).toEqual([]);
    expect(await faz(U.adm1, `update casos set cliente = 'Cliente' where id = $1 returning id`, [casos.mem1])).toHaveLength(1);
  });

  it("exportar parecer: o Supervisionado pede revisão uma vez e, aprovada, exporta", async () => {
    const [c] = await ve(U.sup1, `select id from consultas where pergunta = 'pergunta sup1'`);
    expect((await faz(U.sup1, `select app.pedir_exportacao($1, 'pdf') r`, [c.id]))[0].r).toBe("revisao");
    expect((await faz(U.sup1, `select app.pedir_exportacao($1, 'pdf') r`, [c.id]))[0].r).toBe("pendente");
    const [rev] = await ve(U.mem1, `select id from revisoes where acao = 'exportar_parecer' and status = 'pendente'`);
    await faz(U.mem1, `select app.decidir_revisao($1, true, null)`, [rev.id]);
    expect((await faz(U.sup1, `select app.pedir_exportacao($1, 'pdf') r`, [c.id]))[0].r).toBe("liberado");
    expect((await faz(U.mem1, `select app.pedir_exportacao($1, 'pdf') r`, [c.id]))[0].r).toBe("liberado");
    const [adm] = await ve(U.adm1, `select id from consultas where pergunta = 'pergunta adm1'`);
    await expect(faz(U.mem1, `select app.pedir_exportacao($1, 'pdf')`, [adm.id])).rejects.toThrow(/consulta_invalida/);
  });

  it("documentos privados: todos leem; enviar só a partir de Membro", async () => {
    await faz(U.mem1, `insert into documentos_privados (escritorio_id, titulo, conteudo) values ($1, 'parecer modelo', 'x')`, [E.A]);
    expect(await ve(U.sup1, `select titulo from documentos_privados`)).toEqual([{ titulo: "parecer modelo" }]);
    await expect(faz(U.sup1, `insert into documentos_privados (escritorio_id, titulo, conteudo) values ($1, 'y', 'y')`, [E.A])).rejects.toThrow(/row-level security/);
  });
});

describe("auditoria por nível", () => {
  it("Admin lê tudo; Membro e Supervisionado, só as próprias linhas", async () => {
    const quem = (usu: string) => ve(usu, `select distinct usuario_id from auditoria`).then((r) => r.map((x) => x.usuario_id));
    expect((await quem(U.adm1)).length).toBeGreaterThan(1);
    expect(await quem(U.mem1)).toEqual([U.mem1]);
    expect(await quem(U.sup1)).toEqual([U.sup1]);
  });

  it("ninguém grava auditoria em nome de outro", async () => {
    await expect(faz(U.adm1, `insert into auditoria (escritorio_id, usuario_id, acao) values ($1, $2, 'x')`, [E.A, U.tita])).rejects.toThrow(/row-level security/);
  });
});

describe("pessoas e níveis", () => {
  const nivel = async (usu: string) => (await um(`select nivel from membros where escritorio_id = $1 and usuario_id = $2`, [E.A, usu]))?.nivel;

  it("a aplicação não muda nível, nem insere ou apaga membros direto", async () => {
    await expect(faz(U.tita, `update membros set nivel = 'admin' where usuario_id = $1`, [U.mem1])).rejects.toThrow(/permission denied/);
    await expect(faz(U.tita, `insert into membros (escritorio_id, usuario_id, nivel) values ($1, $2, 'membro')`, [E.A, U.bia])).rejects.toThrow(/permission denied/);
    await expect(faz(U.tita, `delete from membros where usuario_id = $1`, [U.mem1])).rejects.toThrow(/permission denied/);
  });

  it("cada um muda o próprio cargo; Admin muda o de todos; Membro não muda o alheio", async () => {
    expect(await faz(U.mem1, `update membros set cargo = 'Associado' where usuario_id = $1 returning cargo`, [U.mem1])).toEqual([{ cargo: "Associado" }]);
    expect(await faz(U.mem1, `update membros set cargo = 'Sócio' where usuario_id = $1 returning cargo`, [U.mem2])).toEqual([]);
    expect(await faz(U.adm1, `update membros set cargo = 'Paralegal' where usuario_id = $1 returning cargo`, [U.sup1])).toEqual([{ cargo: "Paralegal" }]);
  });

  it("Membro não gere pessoas", async () => {
    await expect(faz(U.mem1, `select app.mudar_nivel($1, 'membro')`, [U.sup1])).rejects.toThrow(/sem_permissao/);
  });

  it("ninguém altera o próprio nível nem vira Titular por aqui", async () => {
    await expect(faz(U.adm1, `select app.mudar_nivel($1, 'membro')`, [U.adm1])).rejects.toThrow(/proprio_nivel/);
    await expect(faz(U.tita, `select app.mudar_nivel($1, 'titular')`, [U.adm1])).rejects.toThrow(/use_transferencia/);
  });

  it("Admin promove até Admin, não rebaixa outro Admin nem toca no Titular", async () => {
    await faz(U.adm1, `select app.mudar_nivel($1, 'admin')`, [U.mem2]);
    expect(await nivel(U.mem2)).toBe("admin");
    await expect(faz(U.adm1, `select app.mudar_nivel($1, 'membro')`, [U.mem2])).rejects.toThrow(/so_titular_rebaixa_admin/);
    await expect(faz(U.adm1, `select app.mudar_nivel($1, 'admin')`, [U.tita])).rejects.toThrow(/titular_intocavel/);
    await expect(faz(U.adm1, `select app.remover_membro($1)`, [U.tita])).rejects.toThrow(/titular_intocavel/);
  });

  it("o Titular rebaixa um Admin, e as sessões dele no escritório caem na hora", async () => {
    await db.query(`select app.criar_sessao('tok-mem2', $1, $2, 14)`, [U.mem2, E.A]);
    await faz(U.tita, `select app.mudar_nivel($1, 'membro')`, [U.mem2]);
    expect(await nivel(U.mem2)).toBe("membro");
    expect(await q(`select 1 from sessoes where token_hash = 'tok-mem2'`)).toEqual([]);
    const ultima = await um(`select acao, detalhes from auditoria where acao = 'mudanca_nivel' order by id desc limit 1`);
    expect(ultima.detalhes).toEqual({ de: "admin", para: "membro" });
  });

  it("existe no máximo um Titular por escritório", async () => {
    await expect(db.query(`update membros set nivel = 'titular' where usuario_id = $1`, [U.adm1])).rejects.toThrow(/um_titular/);
  });

  it("suspenso não entra, não vê nada e não conta como assento", async () => {
    await faz(U.adm1, `select app.suspender($1, true)`, [U.sup2]);
    expect(await ve(U.sup2, `select * from casos`)).toEqual([]);
    expect(await ve(U.sup2, `select app.nivel_atual() n`)).toEqual([{ n: null }]);
    await expect(db.query(`select app.criar_sessao('tok-sup2', $1, $2, 14)`, [U.sup2, E.A])).rejects.toThrow(/sem_vinculo/);
    expect((await um(`select app.assentos_em_uso($1) n`, [E.A])).n).toBe(6);
    await faz(U.adm1, `select app.suspender($1, false)`, [U.sup2]);
  });

  it("transferir a titularidade troca os dois de lugar, e só o Titular faz isso", async () => {
    await expect(faz(U.adm1, `select app.transferir_titularidade($1)`, [U.adm2])).rejects.toThrow(/sem_permissao/);
    await faz(U.tita, `select app.transferir_titularidade($1)`, [U.adm1]);
    expect([await nivel(U.tita), await nivel(U.adm1)]).toEqual(["admin", "titular"]);
    await faz(U.adm1, `select app.transferir_titularidade($1)`, [U.tita]);
    expect([await nivel(U.tita), await nivel(U.adm1)]).toEqual(["titular", "admin"]);
  });

  it("remover alguém acaba o vínculo, mas as consultas ficam com o escritório", async () => {
    await expect(faz(U.adm1, `select app.remover_membro($1)`, [U.adm2])).rejects.toThrow(/so_titular_age_sobre_admin/);
    await faz(U.tita, `select app.remover_membro($1)`, [U.sup2]);
    expect(await nivel(U.sup2)).toBeUndefined();
    expect((await ve(U.tita, `select count(*)::int n from consultas where usuario_id = $1`, [U.sup2]))[0].n).toBe(1);
    expect(await q(`select 1 from casos_membros where usuario_id = $1`, [U.sup2])).toEqual([]);
  });

  it("o Titular não sai sem transferir; os demais saem", async () => {
    await expect(faz(U.tita, `select app.sair_do_escritorio()`)).rejects.toThrow(/transfira_antes/);
  });

  it("a lista de pessoas esconde e-mail e último acesso de quem não gere pessoas", async () => {
    const [p] = await ve(U.mem1, `select * from app.pessoas() where usuario_id = $1`, [U.adm1]);
    expect(p).toMatchObject({ nome: "adm1", nivel: "admin", email: null, ultimo_acesso_em: null });
    const [a] = await ve(U.adm1, `select email from app.pessoas() where usuario_id = $1`, [U.mem1]);
    expect(a.email).toBe("mem1@a.adv.br");
  });
});

describe("convites", () => {
  it("Membro não convida e não lê convites", async () => {
    await expect(faz(U.mem1, `select * from app.criar_convite('x@a.adv.br', 'membro', null, 'h')`)).rejects.toThrow(/sem_permissao/);
    expect(await ve(U.mem1, `select * from convites`)).toEqual([]);
  });

  it("Admin não convida acima de si nem para Titular", async () => {
    await expect(faz(U.adm1, `select * from app.criar_convite('x@a.adv.br', 'titular', null, 'h')`)).rejects.toThrow(/use_transferencia/);
    await expect(faz(U.adm1, `select * from app.criar_convite('adm2@a.adv.br', 'membro', null, 'h')`)).rejects.toThrow(/ja_e_membro/);
  });

  it("o convite vale uma vez, só para o e-mail convidado", async () => {
    await faz(U.adm1, `select * from app.criar_convite('Nova@A.adv.br', 'membro', 'Associada', $1)`, [h("convite-nova")]);
    const [info] = await como(null, null, () => q(`select * from app.convite_por_token($1)`, [h("convite-nova")]));
    expect(info).toMatchObject({ escritorio: "Escritório A", email: "nova@a.adv.br", nivel: "membro", cargo: "Associada", tem_conta: false });
    // quem tem outro e-mail não aceita
    await expect(como(null, U.bia, () => q(`select app.aceitar_convite($1)`, [h("convite-nova")]))).rejects.toThrow(/convite_de_outro_email/);
    const [r] = await como(null, null, () => q(`select * from app.cadastrar_por_convite($1, 'Nova', 'scrypt$x')`, [h("convite-nova")]), true);
    expect(r.escritorio_id).toBe(E.A);
    expect((await um(`select nivel, cargo from membros where usuario_id = $1`, [r.usuario_id]))).toEqual({ nivel: "membro", cargo: "Associada" });
    await expect(como(null, null, () => q(`select * from app.cadastrar_por_convite($1, 'De novo', 'h')`, [h("convite-nova")]))).rejects.toThrow(/convite_invalido/);
  });

  it("quem já tem conta aceita estando logado, e passa a ter dois escritórios", async () => {
    await faz(U.bia, `select * from app.criar_convite('tita@a.adv.br', 'membro', 'Consultora', $1)`, [h("convite-tita")], E.B);
    const esc = await como(null, U.tita, async () => (await um(`select app.aceitar_convite($1) e`, [h("convite-tita")])).e, true);
    expect(esc).toBe(E.B);
    expect((await ve(U.tita, `select nome, nivel from app.meus_escritorios()`)).map((x) => `${x.nome}:${x.nivel}`)).toEqual(["Escritório A:titular", "Escritório B:membro"]);
  });

  it("convite vencido, cancelado ou reenviado com outro link não vale", async () => {
    const [c] = await faz(U.adm1, `select * from app.criar_convite('velho@a.adv.br', 'supervisionado', null, $1)`, [h("velho")]);
    await db.query(`update convites set expira_em = now() - interval '1 minute' where id = $1`, [c.id]);
    expect(await q(`select * from app.convite_por_token($1)`, [h("velho")])).toEqual([]);
    await expect(faz(U.adm1, `select app.reenviar_convite($1, $2)`, [c.id, h("velho2")])).resolves.toBeTruthy();
    expect(await q(`select * from app.convite_por_token($1)`, [h("velho")])).toEqual([]);
    expect(await q(`select email from app.convite_por_token($1)`, [h("velho2")])).toEqual([{ email: "velho@a.adv.br" }]);
    await faz(U.adm1, `select app.cancelar_convite($1)`, [c.id]);
    expect(await q(`select * from app.convite_por_token($1)`, [h("velho2")])).toEqual([]);
  });

  it("acima dos assentos: o convite do Admin espera o Titular; o Titular confirma na hora", async () => {
    const emUso = (await um(`select app.assentos_em_uso($1) n`, [E.A])).n;
    await db.query(`update escritorios set stripe_assinatura_id = 'sub_1', assentos = $2 where id = $1`, [E.A, emUso]);
    const [c] = await faz(U.adm1, `select * from app.criar_convite('extra@a.adv.br', 'membro', null, $1)`, [h("extra")]);
    expect(c.aguarda_titular).toBe(true);
    expect(await q(`select * from app.convite_por_token($1)`, [h("extra")])).toEqual([]);
    await expect(faz(U.tita, `select * from app.criar_convite('outro@a.adv.br', 'membro', null, $1)`, [h("outro")])).rejects.toThrow(/confirmar_assento/);
    await faz(U.tita, `select * from app.criar_convite('outro@a.adv.br', 'membro', null, $1, true)`, [h("outro")]);
    await expect(faz(U.adm1, `select app.liberar_convite($1, $2)`, [c.id, h("extra2")])).rejects.toThrow(/sem_permissao/);
    expect((await faz(U.tita, `select app.liberar_convite($1, $2) e`, [c.id, h("extra2")]))[0].e).toBe("extra@a.adv.br");
    await db.query(`update escritorios set stripe_assinatura_id = null, assentos = null where id = $1`, [E.A]);
  });
});

describe("configurações e domínio do escritório", () => {
  it("só Admin e Titular configuram, e só as colunas de configuração", async () => {
    expect(await faz(U.mem1, `update escritorios set nome = 'X' returning id`)).toEqual([]);
    expect(await faz(U.adm1, `update escritorios set exige_2fa = 'admins', sessao_horas = 72 returning exige_2fa`)).toEqual([{ exige_2fa: "admins" }]);
    await expect(faz(U.adm1, `update escritorios set plano = 'corporativo'`)).rejects.toThrow(/permission denied/);
    await expect(faz(U.tita, `update escritorios set assentos = 99`)).rejects.toThrow(/permission denied/);
  });

  it("o domínio precisa ser o do e-mail de quem o declara", async () => {
    await expect(faz(U.adm1, `update escritorios set dominio_email = 'outro.com.br'`)).rejects.toThrow(/dominio_de_outro_email/);
    await faz(U.adm1, `update escritorios set dominio_email = 'a.adv.br'`);
  });

  it("quem se cadastra com o domínio pede para entrar, e um Admin aprova", async () => {
    const [d] = await como(null, null, () => q(`select * from app.escritorio_do_dominio('Fulana@A.adv.br')`));
    expect(d.nome).toBe("Escritório A");
    const u = await como(null, null, async () => (await um(`select app.cadastrar_pedindo_entrada('fulana@a.adv.br', 'Fulana', 'h', $1) u`, [E.A])).u, true);
    expect((await q(`select * from app.credenciais('fulana@a.adv.br')`))[0]).toMatchObject({ escritorio_id: null, pedido_pendente: "Escritório A" });
    const [p] = await ve(U.adm1, `select id from app.pedidos_pendentes()`);
    await expect(faz(U.adm1, `select app.decidir_entrada($1, true, 'titular', null)`, [p.id])).rejects.toThrow(/use_transferencia/);
    await faz(U.adm1, `select app.decidir_entrada($1, true, 'supervisionado', 'Estagiária')`, [p.id]);
    expect((await q(`select * from app.credenciais('fulana@a.adv.br')`))[0]).toMatchObject({ escritorio_id: E.A, pedido_pendente: null });
    expect(await um(`select nivel from membros where usuario_id = $1`, [u])).toEqual({ nivel: "supervisionado" });
  });
});

describe("sessões e verificação em duas etapas", () => {
  it("a sessão traz nível e cargo; cada um lista e encerra só as suas", async () => {
    await db.query(`select app.criar_sessao($1, $2, $3, 14, 'Firefox no Linux', 'São Paulo')`, [h("s-mem1-a"), U.mem1, E.A]);
    await db.query(`select app.criar_sessao($1, $2, $3, 14, 'Safari no iPhone', null)`, [h("s-mem1-b"), U.mem1, E.A]);
    const [s] = await como(null, null, () => q(`select * from app.resolver_sessao($1)`, [h("s-mem1-a")]));
    expect(s).toMatchObject({ nivel: "membro", cargo: "Associado", precisa_2fa: false, plataforma: null });
    const lista = await ve(U.mem1, `select aparelho, cidade, atual from app.minhas_sessoes($1) order by aparelho`, [h("s-mem1-a")]);
    expect(lista).toEqual([
      { aparelho: "Firefox no Linux", cidade: "São Paulo", atual: true },
      { aparelho: "Safari no iPhone", cidade: null, atual: false },
    ]);
    const outra = (await q(`select id from sessoes where token_hash = $1`, [h("s-mem1-b")]))[0].id;
    await faz(U.mem2, `select app.encerrar_minha_sessao($1)`, [outra]); // não é dele: nada muda
    expect(await q(`select 1 from sessoes where id = $1`, [outra])).toHaveLength(1);
    expect((await faz(U.mem1, `select app.encerrar_outras_sessoes($1) n`, [h("s-mem1-a")]))[0].n).toBe(1);
  });

  it("a sessão respeita o tempo configurado pelo escritório", async () => {
    const r = await um(`select extract(epoch from expira_em - criada_em) / 3600 as horas from sessoes where token_hash = $1`, [h("s-mem1-a")]);
    expect(Math.round(Number(r.horas))).toBe(72);
  });

  it("com 2FA exigido para Admins, o Admin sem 2FA é levado a ativar", async () => {
    await db.query(`select app.criar_sessao($1, $2, $3, 14)`, [h("s-adm1"), U.adm1, E.A]);
    expect((await um(`select precisa_2fa from app.resolver_sessao($1)`, [h("s-adm1")])).precisa_2fa).toBe(true);
  });

  it("desafio: código aceito uma vez, sem reuso; recuperação vale uma vez; 5 erros encerram", async () => {
    await faz(U.adm1, `select app.totp_preparar('\\x01'::bytea)`);
    await faz(U.adm1, `select app.totp_ativar(100, $1)`, [[h("REC-1"), h("REC-2")]]);
    expect((await um(`select precisa_2fa from app.resolver_sessao($1)`, [h("s-adm1")])).precisa_2fa).toBe(false);
    await expect(faz(U.adm1, `select app.totp_desativar()`)).rejects.toThrow(/2fa_obrigatorio/);

    await db.query(`select app.desafio_criar($1, $2, $3)`, [h("d1"), U.adm1, E.A]);
    expect((await um(`select ultimo_passo from app.desafio_ler($1)`, [h("d1")])).ultimo_passo).toBe("100");
    await expect(db.query(`select * from app.desafio_concluir($1, 100)`, [h("d1")])).rejects.toThrow(/codigo_reusado/);
    await db.query(`select app.desafio_criar($1, $2, $3)`, [h("d2"), U.adm1, E.A]);
    expect(await um(`select * from app.desafio_concluir($1, 101)`, [h("d2")])).toEqual({ usuario_id: U.adm1, escritorio_id: E.A });

    await db.query(`select app.desafio_criar($1, $2, $3)`, [h("d3"), U.adm1, E.A]);
    expect((await um(`select * from app.desafio_recuperacao($1, $2)`, [h("d3"), h("REC-1")])).usuario_id).toBe(U.adm1);
    await db.query(`select app.desafio_criar($1, $2, $3)`, [h("d4"), U.adm1, E.A]);
    expect(await q(`select * from app.desafio_recuperacao($1, $2)`, [h("d4"), h("REC-1")])).toEqual([]); // já usado
    for (let i = 0; i < 4; i++) await db.query(`select app.desafio_falhou($1)`, [h("d4")]);
    expect(await q(`select * from app.desafio_ler($1)`, [h("d4")])).toEqual([]);
  });

  it("trocar a senha derruba as outras sessões", async () => {
    await db.query(`select app.criar_sessao($1, $2, $3, 14)`, [h("s-adm1-b"), U.adm1, E.A]);
    await faz(U.adm1, `select app.trocar_senha('scrypt$novo', $1)`, [h("s-adm1")]);
    expect((await q(`select token_hash from sessoes where usuario_id = $1`, [U.adm1])).map((x) => x.token_hash)).toEqual([h("s-adm1")]);
  });

  it("app_user não lê segredos nem desafios direto", async () => {
    await expect(ve(U.adm1, `select totp_segredo_cifrado from usuarios`)).rejects.toThrow(/permission denied/);
    await expect(ve(U.adm1, `select * from desafios_2fa`)).rejects.toThrow(/permission denied/);
  });
});

describe("perfil e troca de e-mail", () => {
  it("atualiza perfil; mudar a OAB volta a marcá-la como só declarada", async () => {
    await db.query(`update usuarios set oab_numero = '123', oab_uf = 'SP', oab_verificada_em = now() where id = $1`, [U.mem1]);
    await faz(U.mem1, `select app.atualizar_perfil('Membro Um', '456', 'SP', '{"vigencia":"hoje"}')`);
    expect(await ve(U.mem1, `select nome, oab_numero, oab_verificada_em, preferencias from app.meu_perfil()`)).toEqual([
      { nome: "Membro Um", oab_numero: "456", oab_verificada_em: null, preferencias: { vigencia: "hoje" } },
    ]);
    await expect(faz(U.mem1, `select app.atualizar_foto('https://exemplo.com/x.png')`)).rejects.toThrow(/foto_invalida/);
  });

  it("o e-mail novo só vale depois de confirmado pelo link", async () => {
    await expect(faz(U.mem1, `select app.pedir_troca_email('mem2@a.adv.br', 'x')`)).rejects.toThrow(/email_em_uso/);
    await faz(U.mem1, `select app.pedir_troca_email('Membro.Um@a.adv.br', $1)`, [h("troca")]);
    expect((await ve(U.mem1, `select email, email_pendente from app.meu_perfil()`))[0]).toEqual({ email: "mem1@a.adv.br", email_pendente: "membro.um@a.adv.br" });
    expect((await um(`select app.confirmar_troca_email($1) e`, [h("troca")])).e).toBe("membro.um@a.adv.br");
    await expect(db.query(`select app.confirmar_troca_email($1)`, [h("troca")])).rejects.toThrow(/link_invalido/);
  });
});

describe("consumo e cobrança", () => {
  it("consumo por pessoa só para Admin e Titular", async () => {
    expect((await ve(U.adm1, `select * from app.consumo(3)`)).length).toBeGreaterThan(0);
    expect(await ve(U.mem1, `select * from app.consumo(3)`)).toEqual([]);
  });

  it("cobrança só para o Titular; o webhook atualiza a assinatura e audita", async () => {
    expect(await ve(U.adm1, `select * from app.cobranca()`)).toEqual([]);
    await faz(U.tita, `select app.stripe_vincular_cliente('cus_A')`);
    await como(null, null, () => q(`select app.stripe_sincronizar('cus_A', 'sub_A', 'active', 9, 'escritorio')`), true);
    expect((await ve(U.tita, `select plano, assentos, assinatura_status from app.cobranca()`))[0]).toEqual({ plano: "escritorio", assentos: 9, assinatura_status: "active" });
    await como(null, null, () => q(`select app.stripe_sincronizar('cus_A', 'sub_A', 'canceled', 9, null)`), true);
    expect((await ve(U.tita, `select assentos, stripe_assinatura_id from app.cobranca()`))[0]).toEqual({ assentos: null, stripe_assinatura_id: null });
  });
});

describe("plataforma", () => {
  beforeAll(async () => {
    await db.query(`insert into equipe_plataforma values ($1, 'curador'), ($2, 'admin')`, [U.mem2, U.bia]);
    const n = await um(`insert into normas (tipo, numero, ano, ementa, url_oficial, publicada_em) values ('LC', '214', 2025, 'IBS', 'https://www.planalto.gov.br/', '2025-01-16') returning id`);
    await db.query(`insert into dispositivos (norma_id, rotulo, texto, vigencia_inicio, origem, status_curadoria) values
      ($1, 'art. 1º', 'texto da semente', '2025-01-16', 'semente', 'em_revisao'),
      ($1, 'art. 1º', 'texto do Planalto', '2025-01-16', 'ingestao', 'rascunho')`, [n.id]);
  });

  it("quem não é da equipe não abre nada da plataforma", async () => {
    await expect(ve(U.tita, `select * from app.plat_escritorios()`, [], null as any)).rejects.toThrow(/sem_permissao/);
  });

  it("o suporte vê escritórios sem o conteúdo das consultas; o curador não vê escritórios", async () => {
    const r = await como(null, U.bia, () => q(`select * from app.plat_escritorios()`));
    expect(r.map((x) => x.nome).sort()).toEqual(["Escritório A", "Escritório B"]);
    expect(Object.keys(r[0])).not.toContain("pergunta");
    await expect(como(null, U.mem2, () => q(`select * from app.plat_escritorios()`))).rejects.toThrow(/sem_permissao/);
  });

  it("o curador vê a semente com o texto do Planalto ao lado e publica", async () => {
    const fila = await como(null, U.mem2, () => q(`select * from app.plat_curadoria_fila() where origem = 'semente' and rotulo = 'art. 1º'`));
    expect(fila[0]).toMatchObject({ texto: "texto da semente", texto_planalto: "texto do Planalto" });
    await como(null, U.mem2, () => q(`select app.plat_curadoria_decidir($1, 'rejeitado', 'divergente do DOU')`, [fila[0].id]), true);
    expect(await um(`select status_curadoria, nota_curadoria, revisado_por from dispositivos where id = $1`, [fila[0].id])).toEqual({
      status_curadoria: "rejeitado", nota_curadoria: "divergente do DOU", revisado_por: U.mem2,
    });
    expect(await q(`select de, para from curadoria_eventos`)).toEqual([{ de: "em_revisao", para: "rejeitado" }]);
  });

  it("só o admin da plataforma nomeia a equipe", async () => {
    await expect(como(null, U.mem2, () => q(`select app.plat_definir_papel('mem1@a.adv.br', 'suporte')`))).rejects.toThrow(/sem_permissao/);
  });
});

describe("encerramento, exportação e exclusão (LGPD)", () => {
  it("exportar tudo é só do Titular e fica na auditoria", async () => {
    await expect(faz(U.adm1, `select app.exportar_escritorio()`)).rejects.toThrow(/sem_permissao/);
    const [r] = await faz(U.tita, `select app.exportar_escritorio() d`);
    expect(r.d.consultas.length).toBeGreaterThan(3);
    expect(JSON.stringify(r.d)).not.toContain("token_hash");
    expect((await q(`select 1 from auditoria where acao = 'exportacao_escritorio'`)).length).toBe(1);
  });

  it("cada pessoa exporta os próprios dados, sem hash de senha nem segredo", async () => {
    const [r] = await ve(U.adm1, `select app.exportar_meus_dados() d`);
    expect(r.d.perfil.email).toBe("adm1@a.adv.br");
    expect(r.d.perfil).not.toHaveProperty("senha_hash");
    expect(r.d.perfil).not.toHaveProperty("totp_segredo_cifrado");
  });

  it("a aplicação não roda o expurgo", async () => {
    await expect(ve(U.tita, `select app.expurgar()`)).rejects.toThrow(/permission denied/);
  });

  it("o Titular não exclui a conta sem transferir; os demais saem e viram ex-membro no expurgo", async () => {
    await expect(faz(U.tita, `select app.pedir_exclusao_conta()`)).rejects.toThrow(/transfira_antes/);
    await faz(U.sup1, `select app.pedir_exclusao_conta()`);
    expect(await q(`select * from app.credenciais('sup1@a.adv.br')`)).toEqual([]);
    expect((await um(`select (app.expurgar()) r`)).r.contas_anonimizadas).toBe(1);
    expect(await ve(U.tita, `select nome from app.autores($1)`, [[U.sup1]])).toEqual([{ nome: "ex-membro" }]);
    expect((await ve(U.tita, `select count(*)::int n from consultas where usuario_id = $1`, [U.sup1]))[0].n).toBe(1);
    expect(await um(`select email from usuarios where id = $1`, [U.sup1])).toEqual({ email: `excluido-${U.sup1}@excluido.invalid` });
    expect((await um(`select concluido_em is not null c from pedidos_exclusao`)).c).toBe(true);
  });

  it("encerrar: só o Titular entra na carência, reabre, e depois de 30 dias o expurgo apaga", async () => {
    await expect(faz(U.adm1, `select app.encerrar_escritorio()`)).rejects.toThrow(/sem_permissao/);
    await faz(U.tita, `select app.encerrar_escritorio()`);
    expect(await ve(U.mem1, `select * from casos`)).toEqual([]);
    expect((await ve(U.tita, `select count(*)::int n from casos`))[0].n).toBe(4);
    await expect(db.query(`select app.criar_sessao('x', $1, $2, 1)`, [U.mem1, E.A])).rejects.toThrow(/sem_vinculo/);
    await faz(U.tita, `select app.reabrir_escritorio()`);
    expect((await ve(U.mem1, `select count(*)::int n from casos`))[0].n).toBeGreaterThan(0);

    await faz(U.tita, `select app.encerrar_escritorio()`);
    await db.query(`update escritorios set encerrado_em = now() - interval '31 days' where id = $1`, [E.A]);
    await expect(faz(U.tita, `select app.reabrir_escritorio()`)).rejects.toThrow(/fora_da_carencia/);
    expect((await um(`select (app.expurgar()) r`)).r.escritorios_apagados).toBe(1);
    expect(await q(`select 1 from escritorios where id = $1`, [E.A])).toEqual([]);
    expect(await q(`select 1 from consultas where escritorio_id = $1`, [E.A])).toEqual([]);
  });
});

describe("migração de um banco que já tinha sócios, associados e estagiários", () => {
  let antigo: Client;
  const NOME = `${DB}_antigo`;

  beforeAll(async () => {
    await admin.query(`drop database if exists ${NOME}`);
    await admin.query(`create database ${NOME}`);
    const url = new URL(ADMIN);
    url.pathname = `/${NOME}`;
    antigo = new Client({ connectionString: url.toString() });
    await antigo.connect();
    await antigo.query("set client_min_messages = warning");
    for (const f of ["001_init.sql", "002_app.sql"]) await antigo.query(readFileSync(join(__dirname, "../migrations", f), "utf8"));
    await antigo.query(`insert into escritorios (id, nome) values ($1, 'Antigo')`, [E.A]);
    const pessoas = [["s1", "socio", "2026-01-01"], ["s2", "socio", "2026-02-01"], ["as", "associado", "2026-03-01"], ["es", "estagiario", "2026-04-01"]];
    for (const [k, papel, em] of pessoas) {
      const { rows } = await antigo.query(`insert into usuarios (email, nome) values ($1, $1) returning id`, [`${k}@x.br`]);
      await antigo.query(`insert into membros (escritorio_id, usuario_id, papel, criado_em) values ($1, $2, $3, $4)`, [E.A, rows[0].id, papel, em]);
    }
    await antigo.query(readFileSync(join(__dirname, "../migrations/003_perfis.sql"), "utf8"));
  });

  afterAll(async () => {
    await antigo?.end();
    await admin.query(`drop database if exists ${NOME}`);
  });

  it("o sócio mais antigo vira Titular, os outros sócios Admins, e o papel vira cargo", async () => {
    const { rows } = await antigo.query(`select u.nome, m.nivel, m.cargo from membros m join usuarios u on u.id = m.usuario_id order by m.criado_em`);
    expect(rows).toEqual([
      { nome: "s1@x.br", nivel: "titular", cargo: "Sócio" },
      { nome: "s2@x.br", nivel: "admin", cargo: "Sócio" },
      { nome: "as@x.br", nivel: "membro", cargo: "Associado" },
      { nome: "es@x.br", nivel: "supervisionado", cargo: "Estagiário" },
    ]);
  });
});
