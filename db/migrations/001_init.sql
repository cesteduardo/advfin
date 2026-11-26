-- AdvFin — esquema inicial
-- Princípios: base normativa versionada por vigência (pública, sem tenant);
-- dados de escritório isolados por row-level security; auditoria append-only.

create extension if not exists pgcrypto;
-- pgvector: obrigatório em produção; opcional em ambientes de teste sem a extensão.
do $$ begin
  create extension if not exists vector;
exception when others then
  raise notice 'pgvector indisponível neste ambiente; embeddings desativados';
end $$;

-- ───────────────────────── Papéis de banco ─────────────────────────
-- app_user: papel com que a aplicação conecta. Não é dono das tabelas,
-- portanto o RLS se aplica sempre (inclusive com FORCE).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end $$;

create schema if not exists app;

-- Contexto da requisição: a aplicação faz, dentro de cada transação,
--   select set_config('app.escritorio_id', '<uuid>', true);
--   select set_config('app.usuario_id',   '<uuid>', true);
create or replace function app.escritorio_atual() returns uuid
language sql stable as $$
  select nullif(current_setting('app.escritorio_id', true), '')::uuid
$$;

create or replace function app.usuario_atual() returns uuid
language sql stable as $$
  select nullif(current_setting('app.usuario_id', true), '')::uuid
$$;

-- ───────────────────────── Identidade e escritórios ─────────────────────────
create table usuarios (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email = lower(email)),
  nome        text not null,
  oab_numero  text,           -- opcional
  oab_uf      char(2),
  criado_em   timestamptz not null default now(),
  excluido_em timestamptz     -- LGPD: exclusão lógica imediata, física pelo job de expurgo
);

create table escritorios (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  plano     text not null default 'essencial'
            check (plano in ('essencial','escritorio','tributario_pro','corporativo')),
  criado_em timestamptz not null default now()
);

create type papel_escritorio as enum ('socio', 'associado', 'estagiario');

create table membros (
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  papel         papel_escritorio not null,
  criado_em     timestamptz not null default now(),
  primary key (escritorio_id, usuario_id)
);

-- ───────────────────────── Dados do escritório (tenant) ─────────────────────────
create table casos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  titulo        text not null,
  cliente       text,
  criado_por    uuid references usuarios(id),
  criado_em     timestamptz not null default now()
);

create table consultas (
  id              uuid primary key default gen_random_uuid(),
  escritorio_id   uuid not null references escritorios(id) on delete cascade,
  caso_id         uuid references casos(id) on delete set null,
  usuario_id      uuid not null references usuarios(id),
  pergunta        text not null,
  resposta        text,
  data_referencia date not null default current_date,  -- "o que valia em DD/MM/AAAA"
  status          text not null default 'pendente'
                  check (status in ('pendente','respondida','bloqueada_citacao','erro')),
  modelo          text,
  tokens_entrada  integer,
  tokens_saida    integer,
  custo_microreais bigint,   -- custo de inferência em milionésimos de real
  ms_primeira_palavra integer,
  ms_total        integer,
  criado_em       timestamptz not null default now()
);

create table documentos_privados (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  titulo        text not null,
  conteudo      text not null,
  criado_em     timestamptz not null default now()
);

-- Trilha de auditoria: tudo o que a IA produziu e quem viu/exportou. Append-only.
create table auditoria (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  usuario_id    uuid references usuarios(id),
  acao          text not null,     -- 'consulta', 'exportacao_docx', 'acesso_fonte', ...
  alvo_id       uuid,
  detalhes      jsonb not null default '{}',
  criado_em     timestamptz not null default now()
);

-- ───────────────────────── Base normativa (pública, versionada) ─────────────────────────
create table normas (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('EC','LC','LEI','DECRETO','RESOLUCAO','ATO_COMITE_GESTOR','SOLUCAO_CONSULTA','INSTRUCAO_NORMATIVA')),
  numero      text not null,
  ano         integer not null,
  ementa      text not null,
  url_oficial text not null,
  publicada_em date not null,
  unique (tipo, numero, ano)
);

-- Cada versão de um dispositivo vale num intervalo [vigencia_inicio, vigencia_fim).
create table dispositivos (
  id              uuid primary key default gen_random_uuid(),
  norma_id        uuid not null references normas(id),
  rotulo          text not null,            -- 'art. 125', 'art. 9º, § 1º, III'
  texto           text not null,
  vigencia_inicio date not null,
  vigencia_fim    date,                     -- null = vigente
  alterado_por    uuid references normas(id),
  status_curadoria text not null default 'rascunho'
                  check (status_curadoria in ('rascunho','em_revisao','publicado','rejeitado')),
  revisado_por    uuid references usuarios(id),
  revisado_em     timestamptz,
  check (vigencia_fim is null or vigencia_fim > vigencia_inicio)
);

create index dispositivos_vigencia on dispositivos (norma_id, rotulo, vigencia_inicio);

-- Somente o que o curador publicou entra na pesquisa e no verificador de citações.
create view dispositivos_publicados as
  select * from dispositivos where status_curadoria = 'publicado';

-- "O que valia em DATA": a versão publicada cujo intervalo contém a data.
create or replace function dispositivos_vigentes_em(p_data date)
returns setof dispositivos language sql stable security definer set search_path = public as $$
  select * from dispositivos
  where status_curadoria = 'publicado'
    and vigencia_inicio <= p_data
    and (vigencia_fim is null or vigencia_fim > p_data)
$$;

-- ───────────────────────── Captação (landing) e LGPD ─────────────────────────
create table lista_espera (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  nome       text,
  perfil     text,
  consentimento_em timestamptz not null,
  origem     text,
  criado_em  timestamptz not null default now()
);

create table registro_tratamento (  -- LGPD, art. 37
  id          serial primary key,
  operacao    text not null,
  finalidade  text not null,
  base_legal  text not null,
  dados       text not null,
  retencao    text not null
);

create table pedidos_exclusao (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid references usuarios(id),
  email        text not null,
  solicitado_em timestamptz not null default now(),
  concluido_em  timestamptz
);

-- ───────────────────────── Row-level security ─────────────────────────
alter table escritorios        enable row level security;
alter table membros            enable row level security;
alter table casos              enable row level security;
alter table consultas          enable row level security;
alter table documentos_privados enable row level security;
alter table auditoria          enable row level security;

alter table escritorios        force row level security;
alter table membros            force row level security;
alter table casos              force row level security;
alter table consultas          force row level security;
alter table documentos_privados force row level security;
alter table auditoria          force row level security;

-- Pertencimento: o usuário atual precisa ser membro do escritório atual.
create or replace function app.membro_do_escritorio_atual() returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from membros
    where escritorio_id = app.escritorio_atual()
      and usuario_id = app.usuario_atual()
  )
$$;

create policy escritorio_isolado on escritorios
  using (id = app.escritorio_atual() and app.membro_do_escritorio_atual());

create policy membros_isolados on membros
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual());

create policy casos_isolados on casos
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual())
  with check (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual());

create policy consultas_isoladas on consultas
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual())
  with check (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual());

create policy documentos_isolados on documentos_privados
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual())
  with check (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual());

-- Auditoria: leitura isolada, inserção isolada, sem update/delete.
create policy auditoria_leitura on auditoria for select
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual());
create policy auditoria_insercao on auditoria for insert
  with check (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual());

-- ───────────────────────── Permissões do papel da aplicação ─────────────────────────
grant usage on schema public, app to app_user;
grant execute on all functions in schema app to app_user;
grant select, insert, update, delete on escritorios, membros, casos, consultas, documentos_privados to app_user;
grant select, insert on auditoria to app_user;            -- sem update/delete: append-only
grant select on normas, dispositivos_publicados to app_user;
grant execute on function dispositivos_vigentes_em(date) to app_user;
grant insert on lista_espera, pedidos_exclusao to app_user;
grant usage on all sequences in schema public to app_user;
