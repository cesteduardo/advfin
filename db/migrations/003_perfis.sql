-- AdvFin: perfis, níveis de acesso e administração do escritório.
-- Plano em docs/PLANO-PERFIS-PERMISSOES.md. Rode como dono das tabelas com BYPASSRLS,
-- como as migrações anteriores.
--
-- Três coisas separadas:
--   cargo       texto livre do perfil (Sócio, Associada, Paralegal). Não dá permissão.
--   nivel       o que a pessoa pode fazer: supervisionado < membro < admin < titular.
--   plataforma  equipe do AdvFin (admin, curador, suporte), fora dos escritórios.
--
-- Quem garante é o banco: a matriz de permissões fica em app.permissoes, as políticas
-- de RLS perguntam app.pode(ação) e app.nivel_atual(), e as regras entre linhas
-- (um Titular, ninguém acima de si) ficam em funções security definer.

begin;

-- ───────────────────────── Nível de acesso, separado do cargo ─────────────────────────
create type nivel_acesso as enum ('supervisionado', 'membro', 'admin', 'titular');  -- em ordem crescente

alter table membros add column nivel nivel_acesso;
update membros set nivel = case papel when 'socio' then 'admin'::nivel_acesso
                                      when 'associado' then 'membro'::nivel_acesso
                                      else 'supervisionado'::nivel_acesso end;
-- Exatamente um Titular por escritório: o sócio mais antigo. Os demais sócios viram Admins.
update membros m set nivel = 'titular'
from (select escritorio_id, usuario_id,
             row_number() over (partition by escritorio_id order by criado_em, usuario_id) as n
      from membros where papel = 'socio') o
where o.n = 1 and m.escritorio_id = o.escritorio_id and m.usuario_id = o.usuario_id;
alter table membros alter column nivel set not null;

alter table membros rename column papel to cargo;
alter table membros alter column cargo drop not null;
alter table membros alter column cargo type text using (
  case cargo::text when 'socio' then 'Sócio' when 'associado' then 'Associado' else 'Estagiário' end);
alter table membros add constraint cargo_curto check (cargo is null or length(cargo) <= 80);
alter table membros add column suspenso_em timestamptz,
                    add column ultimo_acesso_em timestamptz;
create unique index um_titular on membros (escritorio_id) where nivel = 'titular';

-- resolver_sessao devolvia o enum antigo; sai antes do tipo.
drop function if exists app.resolver_sessao(text);
drop type papel_escritorio;

-- ───────────────────────── Perfil ─────────────────────────
alter table usuarios add column foto_url text check (foto_url is null or length(foto_url) <= 400000),
                     add column oab_verificada_em timestamptz,
                     add column totp_segredo_cifrado bytea,      -- AES-256-GCM, cifrado na aplicação
                     add column totp_ativado_em timestamptz,
                     add column totp_ultimo_passo bigint,        -- impede reusar o mesmo código
                     add column codigos_recuperacao text[] not null default '{}',  -- sha256 de cada código
                     add column preferencias jsonb not null default '{}',
                     add column senha_trocada_em timestamptz,
                     add column anonimizado_em timestamptz;

-- Troca de e-mail: vale só depois de confirmada no endereço novo.
create table trocas_email (
  token_hash  text primary key,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  novo_email  text not null check (novo_email = lower(novo_email)),
  expira_em   timestamptz not null,
  confirmado_em timestamptz
);
alter table trocas_email enable row level security;
alter table trocas_email force row level security;

-- Segundo passo do login com 2FA: senha conferida, código ainda não.
create table desafios_2fa (
  token_hash    text primary key,
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  tentativas    integer not null default 0,
  expira_em     timestamptz not null
);
alter table desafios_2fa enable row level security;
alter table desafios_2fa force row level security;

-- Sessões ganham identificador público (para listar e encerrar), aparelho, cidade e último uso.
alter table sessoes add column id uuid not null default gen_random_uuid() unique,
                    add column aparelho text,
                    add column cidade text,
                    add column ultimo_uso_em timestamptz not null default now();

-- ───────────────────────── Escritório: configurações, cobrança e encerramento ─────────────────────────
alter table escritorios add column logo_url text check (logo_url is null or length(logo_url) <= 400000),
                        add column dominio_email text check (dominio_email is null or dominio_email ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
                        add column exige_2fa text not null default 'nao' check (exige_2fa in ('nao', 'admins', 'todos')),
                        add column sessao_horas integer not null default 336 check (sessao_horas between 1 and 720),
                        add column encerrado_em timestamptz,
                        add column stripe_cliente_id text unique,
                        add column stripe_assinatura_id text unique,
                        add column assinatura_status text,
                        add column assentos integer check (assentos is null or assentos >= 1);
create unique index dominio_unico on escritorios (dominio_email) where dominio_email is not null;

-- ───────────────────────── Convites e pedidos de entrada ─────────────────────────
create table convites (
  id              uuid primary key default gen_random_uuid(),
  escritorio_id   uuid not null references escritorios(id) on delete cascade,
  email           text not null check (email = lower(email)),
  nivel           nivel_acesso not null check (nivel <> 'titular'),
  cargo           text check (cargo is null or length(cargo) <= 80),
  token_hash      text not null unique,
  convidado_por   uuid not null references usuarios(id),
  criado_em       timestamptz not null default now(),
  expira_em       timestamptz not null,
  aguarda_titular boolean not null default false,  -- acima dos assentos: o Titular confirma
  aceito_em       timestamptz,
  aceito_por      uuid references usuarios(id),
  cancelado_em    timestamptz
);
create index convites_escritorio on convites (escritorio_id) where aceito_em is null and cancelado_em is null;

-- Quem se cadastra com o domínio do escritório pede para entrar; um Admin aprova.
create table pedidos_entrada (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  decidido_em   timestamptz,
  decidido_por  uuid references usuarios(id),
  aprovado      boolean,
  unique (escritorio_id, usuario_id)
);

-- ───────────────────────── Casos por nível ─────────────────────────
-- Um caso (e cada consulta ou simulação fora de caso) nasce visível ao autor e a quem tem
-- nível >= nivel_minimo = max(nível do autor, membro), com teto em admin: o Titular e os
-- Admins veem tudo. Para mostrar a alguém abaixo, a pessoa é incluída no caso.
alter table casos add column nivel_minimo nivel_acesso not null default 'membro';
alter table consultas add column nivel_minimo nivel_acesso not null default 'membro';
alter table simulacoes add column nivel_minimo nivel_acesso not null default 'membro';
alter table casos alter column criado_por set default app.usuario_atual();

create table casos_membros (
  caso_id      uuid not null references casos(id) on delete cascade,
  usuario_id   uuid not null references usuarios(id) on delete cascade,
  incluido_por uuid references usuarios(id),
  incluido_em  timestamptz not null default now(),
  primary key (caso_id, usuario_id)
);

-- Supervisionado: exportar parecer e incluir colega pedem a aprovação de um Membro.
create table revisoes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  solicitante   uuid not null references usuarios(id),
  acao          text not null check (acao in ('exportar_parecer', 'incluir_colega')),
  alvo          jsonb not null,
  status        text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  revisor       uuid references usuarios(id),
  nota          text check (nota is null or length(nota) <= 500),
  criado_em     timestamptz not null default now(),
  decidido_em   timestamptz
);

-- ───────────────────────── Plataforma ─────────────────────────
create table equipe_plataforma (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  papel      text not null check (papel in ('admin', 'curador', 'suporte')),
  criado_em  timestamptz not null default now()
);
alter table equipe_plataforma enable row level security;
alter table equipe_plataforma force row level security;  -- sem política: só por funções

alter table dispositivos add column nota_curadoria text;
create table curadoria_eventos (
  id             bigint generated always as identity primary key,
  dispositivo_id uuid not null references dispositivos(id) on delete cascade,
  usuario_id     uuid references usuarios(id),
  de             text,
  para           text not null,
  nota           text,
  criado_em      timestamptz not null default now()
);
alter table curadoria_eventos enable row level security;
alter table curadoria_eventos force row level security;

alter table pedidos_exclusao add column prazo_em timestamptz,
                             add column observacao text;

-- ───────────────────────── Matriz de permissões, em dados ─────────────────────────
-- efeito 'pode' = livre; 'revisao' = pode, com aprovação de um Membro. Ausência = não pode.
create table app.permissoes (
  acao   text not null,
  nivel  nivel_acesso not null,
  efeito text not null check (efeito in ('pode', 'revisao')),
  primary key (acao, nivel)
);
insert into app.permissoes (acao, nivel, efeito)
select a.acao, n.nivel::nivel_acesso,
       case when n.nivel = 'supervisionado' and a.excecao = 'revisao' then 'revisao' else 'pode' end
from (values
  -- ação                     menor nível com acesso   o Supervisionado pede revisão?
  ('usar_ferramentas',        'supervisionado',        null),
  ('criar_caso',              'supervisionado',        null),
  ('incluir_colega',          'supervisionado',        'revisao'),
  ('exportar_parecer',        'supervisionado',        'revisao'),
  ('enviar_documentos',       'membro',                null),
  ('ver_auditoria',           'admin',                 null),
  ('gerir_pessoas',           'admin',                 null),
  ('configurar_escritorio',   'admin',                 null),
  ('ver_consumo',             'admin',                 null),
  ('gerir_cobranca',          'titular',               null),
  ('transferir_titularidade', 'titular',               null),
  ('exportar_escritorio',     'titular',               null),
  ('encerrar_escritorio',     'titular',               null)
) as a(acao, minimo, excecao)
cross join unnest(enum_range(null::nivel_acesso)) as n(nivel)
where n.nivel >= a.minimo::nivel_acesso;

-- ───────────────────────── Contexto: nível e permissão ─────────────────────────
-- Nível do usuário no escritório atual. Suspenso não tem nível; escritório encerrado
-- (na carência de 30 dias) só abre para o Titular, que pode exportar ou reabrir.
create or replace function app.nivel_atual() returns nivel_acesso
language sql stable security definer set search_path = public, app as $$
  select m.nivel from membros m join escritorios e on e.id = m.escritorio_id
  where m.escritorio_id = app.escritorio_atual() and m.usuario_id = app.usuario_atual()
    and m.suspenso_em is null and (e.encerrado_em is null or m.nivel = 'titular')
$$;

create or replace function app.membro_do_escritorio_atual() returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.nivel_atual() is not null
$$;

create or replace function app.pode(p_acao text) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from app.permissoes p
                 where p.acao = p_acao and p.nivel = app.nivel_atual() and p.efeito = 'pode')
$$;

create or replace function app.pede_revisao(p_acao text) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from app.permissoes p
                 where p.acao = p_acao and p.nivel = app.nivel_atual() and p.efeito = 'revisao')
$$;

create or replace function app.exigir(p_acao text) returns void
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not app.pode(p_acao) then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
end $$;

-- Teto e piso da visibilidade a partir do nível do autor.
create or replace function app.nivel_visibilidade(n nivel_acesso) returns nivel_acesso
language sql immutable as $$
  select greatest('membro'::nivel_acesso, least(coalesce(n, 'membro'), 'admin'::nivel_acesso))
$$;

-- Registro de auditoria a partir de dentro das funções (escritório e usuário do contexto).
create or replace function app.auditar(p_acao text, p_alvo uuid default null, p_detalhes jsonb default '{}')
returns void language sql security definer set search_path = public, app as $$
  insert into auditoria (escritorio_id, usuario_id, acao, alvo_id, detalhes)
  values (app.escritorio_atual(), app.usuario_atual(), p_acao, p_alvo, coalesce(p_detalhes, '{}'))
$$;

create or replace function app.incluido_no_caso(p_caso uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from casos_membros where caso_id = p_caso and usuario_id = app.usuario_atual())
$$;

create or replace function app.caso_visivel(p_caso uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from casos c
    where c.id = p_caso and c.escritorio_id = app.escritorio_atual() and app.nivel_atual() is not null
      and (c.criado_por = app.usuario_atual() or app.nivel_atual() >= c.nivel_minimo or app.incluido_no_caso(c.id)))
$$;

-- O nível mínimo é calculado no banco, do nível do autor; a aplicação não escolhe.
create or replace function app.definir_nivel_minimo() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare autor uuid; n nivel_acesso;
begin
  -- Um comando por ramo: new.criado_por só existe em casos.
  if tg_table_name = 'casos' then autor := new.criado_por; else autor := new.usuario_id; end if;
  select nivel into n from membros where escritorio_id = new.escritorio_id and usuario_id = autor;
  new.nivel_minimo := app.nivel_visibilidade(n);
  return new;
end $$;

create trigger casos_nivel before insert on casos for each row execute function app.definir_nivel_minimo();
create trigger consultas_nivel before insert on consultas for each row execute function app.definir_nivel_minimo();
create trigger simulacoes_nivel before insert on simulacoes for each row execute function app.definir_nivel_minimo();

-- ───────────────────────── RLS por nível ─────────────────────────
alter table convites        enable row level security;
alter table pedidos_entrada enable row level security;
alter table casos_membros   enable row level security;
alter table revisoes        enable row level security;
alter table convites        force row level security;
alter table pedidos_entrada force row level security;
alter table casos_membros   force row level security;
alter table revisoes        force row level security;

-- escritorios: todos leem o seu; só quem configura altera, e só as colunas de configuração.
drop policy escritorio_isolado on escritorios;
create policy escritorio_leitura on escritorios for select
  using (id = app.escritorio_atual() and app.membro_do_escritorio_atual());
create policy escritorio_configuracao on escritorios for update
  using (id = app.escritorio_atual() and app.pode('configurar_escritorio'))
  with check (id = app.escritorio_atual());

-- membros: todos leem; cada um muda o próprio cargo, e quem gere pessoas muda o de todos.
-- Nível, suspensão, entrada e saída só pelas funções abaixo.
drop policy membros_isolados on membros;
create policy membros_leitura on membros for select
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual());
create policy membros_cargo on membros for update
  using (escritorio_id = app.escritorio_atual() and (usuario_id = app.usuario_atual() or app.pode('gerir_pessoas')))
  with check (escritorio_id = app.escritorio_atual());

-- casos
drop policy casos_isolados on casos;
create policy casos_leitura on casos for select
  using (escritorio_id = app.escritorio_atual() and app.nivel_atual() is not null
         and (criado_por = app.usuario_atual() or app.nivel_atual() >= nivel_minimo or app.incluido_no_caso(id)));
create policy casos_criacao on casos for insert
  with check (escritorio_id = app.escritorio_atual() and app.pode('criar_caso') and criado_por = app.usuario_atual());
create policy casos_edicao on casos for update
  using (escritorio_id = app.escritorio_atual() and app.caso_visivel(id)
         and (criado_por = app.usuario_atual() or app.nivel_atual() >= 'admin'))
  with check (escritorio_id = app.escritorio_atual());
create policy casos_exclusao on casos for delete
  using (escritorio_id = app.escritorio_atual() and app.caso_visivel(id)
         and (criado_por = app.usuario_atual() or app.nivel_atual() >= 'admin'));

create policy casos_membros_leitura on casos_membros for select using (app.caso_visivel(caso_id));

-- consultas e simulações: as próprias, as de nível visível fora de caso, e as de casos visíveis.
drop policy consultas_isoladas on consultas;
create policy consultas_leitura on consultas for select
  using (escritorio_id = app.escritorio_atual() and app.nivel_atual() is not null
         and (usuario_id = app.usuario_atual()
              or (caso_id is null and app.nivel_atual() >= nivel_minimo)
              or (caso_id is not null and app.caso_visivel(caso_id))));
create policy consultas_criacao on consultas for insert
  with check (escritorio_id = app.escritorio_atual() and usuario_id = app.usuario_atual()
              and app.pode('usar_ferramentas') and (caso_id is null or app.caso_visivel(caso_id)));
create policy consultas_proprias on consultas for update
  using (escritorio_id = app.escritorio_atual() and usuario_id = app.usuario_atual() and app.nivel_atual() is not null)
  with check (escritorio_id = app.escritorio_atual() and usuario_id = app.usuario_atual()
              and (caso_id is null or app.caso_visivel(caso_id)));
create policy consultas_exclusao on consultas for delete
  using (escritorio_id = app.escritorio_atual() and usuario_id = app.usuario_atual() and app.nivel_atual() is not null);

drop policy simulacoes_isoladas on simulacoes;
create policy simulacoes_leitura on simulacoes for select
  using (escritorio_id = app.escritorio_atual() and app.nivel_atual() is not null
         and (usuario_id = app.usuario_atual()
              or (caso_id is null and app.nivel_atual() >= nivel_minimo)
              or (caso_id is not null and app.caso_visivel(caso_id))));
create policy simulacoes_criacao on simulacoes for insert
  with check (escritorio_id = app.escritorio_atual() and usuario_id = app.usuario_atual()
              and app.pode('usar_ferramentas') and (caso_id is null or app.caso_visivel(caso_id)));
create policy simulacoes_proprias on simulacoes for update
  using (escritorio_id = app.escritorio_atual() and usuario_id = app.usuario_atual() and app.nivel_atual() is not null)
  with check (escritorio_id = app.escritorio_atual() and usuario_id = app.usuario_atual()
              and (caso_id is null or app.caso_visivel(caso_id)));
create policy simulacoes_exclusao on simulacoes for delete
  using (escritorio_id = app.escritorio_atual() and usuario_id = app.usuario_atual() and app.nivel_atual() is not null);

-- documentos privados: todos leem; enviar, editar e apagar a partir de Membro.
drop policy documentos_isolados on documentos_privados;
create policy documentos_leitura on documentos_privados for select
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual());
create policy documentos_escrita on documentos_privados for insert
  with check (escritorio_id = app.escritorio_atual() and app.pode('enviar_documentos'));
create policy documentos_edicao on documentos_privados for update
  using (escritorio_id = app.escritorio_atual() and app.pode('enviar_documentos'))
  with check (escritorio_id = app.escritorio_atual());
create policy documentos_exclusao on documentos_privados for delete
  using (escritorio_id = app.escritorio_atual() and app.pode('enviar_documentos'));

-- auditoria: Admin e Titular leem tudo; os demais, só as próprias linhas. Ninguém grava em nome de outro.
drop policy auditoria_leitura on auditoria;
drop policy auditoria_insercao on auditoria;
create policy auditoria_leitura on auditoria for select
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual()
         and (app.pode('ver_auditoria') or usuario_id = app.usuario_atual()));
create policy auditoria_insercao on auditoria for insert
  with check (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual()
              and usuario_id = app.usuario_atual());

-- convites e pedidos: só quem gere pessoas lê; escrita só pelas funções.
create policy convites_leitura on convites for select
  using (escritorio_id = app.escritorio_atual() and app.pode('gerir_pessoas'));
create policy pedidos_leitura on pedidos_entrada for select
  using (escritorio_id = app.escritorio_atual() and app.pode('gerir_pessoas'));

-- revisões: o solicitante vê as suas; Membros para cima veem as do escritório.
create policy revisoes_leitura on revisoes for select
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual()
         and (solicitante = app.usuario_atual() or app.nivel_atual() >= 'membro'));

-- ───────────────────────── Cadastro, credenciais e sessões ─────────────────────────
create or replace function app.cadastrar(p_email text, p_nome text, p_senha_hash text, p_escritorio text)
returns table (usuario_id uuid, escritorio_id uuid)
language plpgsql security definer set search_path = public, app as $$
declare u uuid; e uuid;
begin
  if exists (select 1 from usuarios where email = lower(p_email)) then
    raise exception 'email_em_uso' using errcode = 'P0001';
  end if;
  insert into usuarios (email, nome, senha_hash) values (lower(p_email), p_nome, p_senha_hash) returning id into u;
  insert into escritorios (nome) values (p_escritorio) returning id into e;
  insert into membros (escritorio_id, usuario_id, nivel, cargo) values (e, u, 'titular', null);
  insert into auditoria (escritorio_id, usuario_id, acao) values (e, u, 'cadastro');
  return query select u, e;
end $$;

-- Login: hash para conferência, o escritório em que entra (o último usado, se ainda ativo),
-- se pede o segundo fator e, sem escritório, o pedido de entrada pendente.
drop function if exists app.credenciais(text);
create or replace function app.credenciais(p_email text)
returns table (usuario_id uuid, senha_hash text, escritorio_id uuid, totp_ativo boolean, pedido_pendente text)
language sql stable security definer set search_path = public as $$
  select u.id, u.senha_hash,
         (select m.escritorio_id from membros m join escritorios e on e.id = m.escritorio_id
          where m.usuario_id = u.id and m.suspenso_em is null and (e.encerrado_em is null or m.nivel = 'titular')
          order by m.ultimo_acesso_em desc nulls last, m.criado_em limit 1),
         u.totp_ativado_em is not null,
         (select e.nome from pedidos_entrada p join escritorios e on e.id = p.escritorio_id
          where p.usuario_id = u.id and p.decidido_em is null limit 1)
  from usuarios u
  where u.email = lower(p_email) and u.excluido_em is null
$$;

-- Vínculo ativo (não suspenso; em escritório encerrado, só o Titular).
create or replace function app.vinculo_ativo(p_usuario uuid, p_escritorio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros m join escritorios e on e.id = m.escritorio_id
                 where m.usuario_id = p_usuario and m.escritorio_id = p_escritorio and m.suspenso_em is null
                   and (e.encerrado_em is null or m.nivel = 'titular'))
$$;

drop function if exists app.criar_sessao(text, uuid, uuid, integer);
create or replace function app.criar_sessao(p_token_hash text, p_usuario uuid, p_escritorio uuid, p_dias integer,
                                            p_aparelho text default null, p_cidade text default null)
returns void language plpgsql security definer set search_path = public, app as $$
declare horas integer;
begin
  if not app.vinculo_ativo(p_usuario, p_escritorio) then
    raise exception 'sem_vinculo' using errcode = 'P0001';
  end if;
  select least(p_dias * 24, sessao_horas) into horas from escritorios where id = p_escritorio;
  delete from sessoes where usuario_id = p_usuario and expira_em < now();
  insert into sessoes (token_hash, usuario_id, escritorio_id, expira_em, aparelho, cidade)
  values (p_token_hash, p_usuario, p_escritorio, now() + make_interval(hours => horas),
          left(p_aparelho, 200), left(p_cidade, 80));
  update membros set ultimo_acesso_em = now() where usuario_id = p_usuario and escritorio_id = p_escritorio;
  insert into auditoria (escritorio_id, usuario_id, acao, detalhes)
  values (p_escritorio, p_usuario, 'login', jsonb_build_object('aparelho', left(p_aparelho, 200), 'cidade', left(p_cidade, 80)));
end $$;

-- Resolve a sessão e marca o último uso (no máximo uma escrita a cada 5 minutos).
create or replace function app.resolver_sessao(p_token_hash text)
returns table (usuario_id uuid, escritorio_id uuid, nome text, email text, escritorio text, nivel nivel_acesso,
               cargo text, sessao_id uuid, foto_url text, precisa_2fa boolean, encerrado_em timestamptz,
               plataforma text, preferencias jsonb, logo_url text)
language plpgsql security definer set search_path = public, app as $$
begin
  update sessoes s set ultimo_uso_em = now()
  where s.token_hash = p_token_hash and s.expira_em > now() and s.ultimo_uso_em < now() - interval '5 minutes';
  return query
  select s.usuario_id, s.escritorio_id, u.nome, u.email, e.nome, m.nivel, m.cargo, s.id, u.foto_url,
         (e.exige_2fa = 'todos' or (e.exige_2fa = 'admins' and m.nivel >= 'admin')) and u.totp_ativado_em is null,
         e.encerrado_em, (select p.papel from equipe_plataforma p where p.usuario_id = s.usuario_id),
         u.preferencias, e.logo_url
  from sessoes s
  join usuarios u on u.id = s.usuario_id and u.excluido_em is null
  join escritorios e on e.id = s.escritorio_id
  join membros m on m.usuario_id = s.usuario_id and m.escritorio_id = s.escritorio_id
  where s.token_hash = p_token_hash and s.expira_em > now()
    and m.suspenso_em is null and (e.encerrado_em is null or m.nivel = 'titular');
end $$;

-- Sessões do usuário atual, com a atual marcada.
create or replace function app.minhas_sessoes(p_token_hash_atual text)
returns table (id uuid, escritorio text, aparelho text, cidade text, criada_em timestamptz, ultimo_uso_em timestamptz, atual boolean)
language sql stable security definer set search_path = public, app as $$
  select s.id, e.nome, s.aparelho, s.cidade, s.criada_em, s.ultimo_uso_em, s.token_hash = p_token_hash_atual
  from sessoes s join escritorios e on e.id = s.escritorio_id
  where s.usuario_id = app.usuario_atual() and s.expira_em > now()
  order by s.ultimo_uso_em desc
$$;

create or replace function app.encerrar_minha_sessao(p_id uuid) returns void
language sql security definer set search_path = public, app as $$
  delete from sessoes where id = p_id and usuario_id = app.usuario_atual()
$$;

create or replace function app.encerrar_outras_sessoes(p_token_hash_atual text) returns integer
language plpgsql security definer set search_path = public, app as $$
declare n integer;
begin
  delete from sessoes where usuario_id = app.usuario_atual() and token_hash <> p_token_hash_atual;
  get diagnostics n = row_count;
  return n;
end $$;

-- Troca de escritório para quem atua em mais de um: a aplicação abre nova sessão no outro.
create or replace function app.meus_escritorios()
returns table (escritorio_id uuid, nome text, nivel nivel_acesso, cargo text, atual boolean)
language sql stable security definer set search_path = public, app as $$
  select e.id, e.nome, m.nivel, m.cargo, e.id = app.escritorio_atual()
  from membros m join escritorios e on e.id = m.escritorio_id
  where m.usuario_id = app.usuario_atual() and m.suspenso_em is null
    and (e.encerrado_em is null or m.nivel = 'titular')
  order by e.nome
$$;

-- ───────────────────────── Perfil ─────────────────────────
create or replace function app.meu_perfil()
returns table (nome text, email text, foto_url text, oab_numero text, oab_uf text, oab_verificada_em timestamptz,
               preferencias jsonb, totp_ativo boolean, codigos_restantes integer, criado_em timestamptz,
               senha_trocada_em timestamptz, email_pendente text)
language sql stable security definer set search_path = public, app as $$
  select u.nome, u.email, u.foto_url, u.oab_numero, u.oab_uf::text, u.oab_verificada_em, u.preferencias,
         u.totp_ativado_em is not null, cardinality(u.codigos_recuperacao), u.criado_em, u.senha_trocada_em,
         (select t.novo_email from trocas_email t where t.usuario_id = u.id and t.confirmado_em is null and t.expira_em > now()
          order by t.expira_em desc limit 1)
  from usuarios u where u.id = app.usuario_atual() and u.excluido_em is null
$$;

create or replace function app.atualizar_perfil(p_nome text, p_oab_numero text, p_oab_uf text, p_preferencias jsonb)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  if length(trim(p_nome)) < 2 or length(p_nome) > 120 then raise exception 'nome_invalido' using errcode = 'P0001'; end if;
  if p_oab_uf is not null and p_oab_uf !~ '^[A-Z]{2}$' then raise exception 'uf_invalida' using errcode = 'P0001'; end if;
  update usuarios set nome = trim(p_nome),
         oab_verificada_em = case when oab_numero is distinct from nullif(trim(p_oab_numero), '')
                                    or oab_uf is distinct from p_oab_uf then null else oab_verificada_em end,
         oab_numero = nullif(trim(p_oab_numero), ''),
         oab_uf = p_oab_uf,
         preferencias = coalesce(p_preferencias, preferencias)
  where id = app.usuario_atual();
end $$;

create or replace function app.atualizar_foto(p_foto_url text) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if p_foto_url is not null and p_foto_url !~ '^data:image/(png|jpeg|webp);base64,' then
    raise exception 'foto_invalida' using errcode = 'P0001';
  end if;
  update usuarios set foto_url = p_foto_url where id = app.usuario_atual();
end $$;

-- Senha: o hash atual vai à aplicação só para conferir a senha antiga.
create or replace function app.minha_senha_hash() returns text
language sql stable security definer set search_path = public, app as $$
  select senha_hash from usuarios where id = app.usuario_atual() and excluido_em is null
$$;

-- Troca a senha e derruba as outras sessões em todos os escritórios.
create or replace function app.trocar_senha(p_novo_hash text, p_token_hash_atual text) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  update usuarios set senha_hash = p_novo_hash, senha_trocada_em = now() where id = app.usuario_atual();
  delete from sessoes where usuario_id = app.usuario_atual() and token_hash <> p_token_hash_atual;
  if app.escritorio_atual() is not null then perform app.auditar('troca_senha'); end if;
end $$;

create or replace function app.pedir_troca_email(p_novo_email text, p_token_hash text) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if exists (select 1 from usuarios where email = lower(p_novo_email)) then
    raise exception 'email_em_uso' using errcode = 'P0001';
  end if;
  delete from trocas_email where usuario_id = app.usuario_atual() and confirmado_em is null;
  insert into trocas_email (token_hash, usuario_id, novo_email, expira_em)
  values (p_token_hash, app.usuario_atual(), lower(p_novo_email), now() + interval '24 hours');
end $$;

-- Confirmação pelo link enviado ao endereço novo: o token é a prova, não há sessão.
create or replace function app.confirmar_troca_email(p_token_hash text) returns text
language plpgsql security definer set search_path = public, app as $$
declare t trocas_email;
begin
  select * into t from trocas_email where token_hash = p_token_hash and confirmado_em is null and expira_em > now();
  if not found then raise exception 'link_invalido' using errcode = 'P0001'; end if;
  if exists (select 1 from usuarios where email = t.novo_email) then raise exception 'email_em_uso' using errcode = 'P0001'; end if;
  update usuarios set email = t.novo_email where id = t.usuario_id;
  update trocas_email set confirmado_em = now() where token_hash = p_token_hash;
  return t.novo_email;
end $$;

-- ───────────────────────── Verificação em duas etapas (TOTP) ─────────────────────────
create or replace function app.totp_meu() returns table (segredo_cifrado bytea, ativo boolean, ultimo_passo bigint)
language sql stable security definer set search_path = public, app as $$
  select totp_segredo_cifrado, totp_ativado_em is not null, totp_ultimo_passo from usuarios where id = app.usuario_atual()
$$;

-- Guarda o segredo novo ainda inativo (só vale depois de confirmado com um código).
create or replace function app.totp_preparar(p_cifrado bytea) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if exists (select 1 from usuarios where id = app.usuario_atual() and totp_ativado_em is not null) then
    raise exception 'ja_ativo' using errcode = 'P0001';
  end if;
  update usuarios set totp_segredo_cifrado = p_cifrado where id = app.usuario_atual();
end $$;

create or replace function app.totp_ativar(p_passo bigint, p_codigos text[]) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  update usuarios set totp_ativado_em = now(), totp_ultimo_passo = p_passo, codigos_recuperacao = p_codigos
  where id = app.usuario_atual() and totp_segredo_cifrado is not null and totp_ativado_em is null;
  if not found then raise exception 'sem_segredo' using errcode = 'P0001'; end if;
  if app.escritorio_atual() is not null then perform app.auditar('ativar_2fa'); end if;
end $$;

create or replace function app.totp_desativar() returns void
language plpgsql security definer set search_path = public, app as $$
begin
  -- Se algum escritório da pessoa exige o 2FA para o nível dela, não desliga.
  if exists (select 1 from membros m join escritorios e on e.id = m.escritorio_id
             where m.usuario_id = app.usuario_atual() and m.suspenso_em is null
               and (e.exige_2fa = 'todos' or (e.exige_2fa = 'admins' and m.nivel >= 'admin'))) then
    raise exception '2fa_obrigatorio' using errcode = 'P0001';
  end if;
  update usuarios set totp_segredo_cifrado = null, totp_ativado_em = null, totp_ultimo_passo = null,
                      codigos_recuperacao = '{}'
  where id = app.usuario_atual();
  if app.escritorio_atual() is not null then perform app.auditar('desativar_2fa'); end if;
end $$;

create or replace function app.totp_novos_codigos(p_codigos text[]) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  update usuarios set codigos_recuperacao = p_codigos where id = app.usuario_atual() and totp_ativado_em is not null;
  if not found then raise exception 'sem_2fa' using errcode = 'P0001'; end if;
end $$;

-- Desafio do login: 5 minutos e 5 tentativas.
create or replace function app.desafio_criar(p_token_hash text, p_usuario uuid, p_escritorio uuid) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if not app.vinculo_ativo(p_usuario, p_escritorio) then raise exception 'sem_vinculo' using errcode = 'P0001'; end if;
  delete from desafios_2fa where usuario_id = p_usuario or expira_em < now();
  insert into desafios_2fa (token_hash, usuario_id, escritorio_id, expira_em) values (p_token_hash, p_usuario, p_escritorio, now() + interval '5 minutes');
end $$;

create or replace function app.desafio_ler(p_token_hash text)
returns table (usuario_id uuid, escritorio_id uuid, segredo_cifrado bytea, ultimo_passo bigint)
language sql stable security definer set search_path = public, app as $$
  select d.usuario_id, d.escritorio_id, u.totp_segredo_cifrado, u.totp_ultimo_passo
  from desafios_2fa d join usuarios u on u.id = d.usuario_id
  where d.token_hash = p_token_hash and d.expira_em > now() and d.tentativas < 5 and u.totp_ativado_em is not null
$$;

create or replace function app.desafio_falhou(p_token_hash text) returns void
language sql security definer set search_path = public, app as $$
  update desafios_2fa set tentativas = tentativas + 1 where token_hash = p_token_hash
$$;

-- Conclui com o passo TOTP aceito (sempre maior que o último, contra reuso do código).
create or replace function app.desafio_concluir(p_token_hash text, p_passo bigint)
returns table (usuario_id uuid, escritorio_id uuid)
language plpgsql security definer set search_path = public, app as $$
declare d desafios_2fa;
begin
  delete from desafios_2fa x where x.token_hash = p_token_hash and x.expira_em > now() and x.tentativas < 5 returning * into d;
  if d.usuario_id is null then raise exception 'desafio_invalido' using errcode = 'P0001'; end if;
  update usuarios u set totp_ultimo_passo = p_passo
  where u.id = d.usuario_id and (u.totp_ultimo_passo is null or u.totp_ultimo_passo < p_passo);
  if not found then raise exception 'codigo_reusado' using errcode = 'P0001'; end if;
  return query select d.usuario_id, d.escritorio_id;
end $$;

create or replace function app.desafio_recuperacao(p_token_hash text, p_codigo_hash text)
returns table (usuario_id uuid, escritorio_id uuid)
language plpgsql security definer set search_path = public, app as $$
declare d desafios_2fa;
begin
  select * into d from desafios_2fa x where x.token_hash = p_token_hash and x.expira_em > now() and x.tentativas < 5;
  if d.usuario_id is null then raise exception 'desafio_invalido' using errcode = 'P0001'; end if;
  update usuarios u set codigos_recuperacao = array_remove(u.codigos_recuperacao, p_codigo_hash)
  where u.id = d.usuario_id and p_codigo_hash = any (u.codigos_recuperacao);
  if not found then
    -- Sem exceção: a tentativa errada precisa ficar contada (5 encerram o desafio).
    update desafios_2fa set tentativas = tentativas + 1 where token_hash = p_token_hash;
    return;
  end if;
  delete from desafios_2fa where token_hash = p_token_hash;
  insert into auditoria (escritorio_id, usuario_id, acao) values (d.escritorio_id, d.usuario_id, 'login_codigo_recuperacao');
  return query select d.usuario_id, d.escritorio_id;
end $$;

-- ───────────────────────── Pessoas do escritório ─────────────────────────
-- Todos veem nome, cargo e nível dos colegas (para incluir num caso); e-mail, último acesso
-- e 2FA só para quem gere pessoas.
create or replace function app.pessoas()
returns table (usuario_id uuid, nome text, email text, cargo text, nivel nivel_acesso, foto_url text,
               oab text, oab_verificada boolean, desde timestamptz, ultimo_acesso_em timestamptz,
               totp_ativo boolean, suspenso_em timestamptz)
language sql stable security definer set search_path = public, app as $$
  select u.id, u.nome, case when app.pode('gerir_pessoas') or u.id = app.usuario_atual() then u.email end,
         m.cargo, m.nivel, u.foto_url,
         case when u.oab_numero is not null then u.oab_numero || '/' || u.oab_uf end, u.oab_verificada_em is not null,
         m.criado_em,
         case when app.pode('gerir_pessoas') then m.ultimo_acesso_em end,
         case when app.pode('gerir_pessoas') then u.totp_ativado_em is not null end,
         m.suspenso_em
  from membros m join usuarios u on u.id = m.usuario_id
  where m.escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual()
    and (m.suspenso_em is null or app.pode('gerir_pessoas'))
  order by m.nivel desc, u.nome
$$;

-- Nome de quem fez algo no escritório, para listas e auditoria. Conta excluída vira "ex-membro".
create or replace function app.autores(p_ids uuid[]) returns table (usuario_id uuid, nome text)
language sql stable security definer set search_path = public, app as $$
  select u.id, case when u.excluido_em is not null then 'ex-membro' else u.nome end
  from usuarios u
  where u.id = any (p_ids) and app.membro_do_escritorio_atual()
    and (exists (select 1 from membros m where m.usuario_id = u.id and m.escritorio_id = app.escritorio_atual())
         or exists (select 1 from auditoria a where a.usuario_id = u.id and a.escritorio_id = app.escritorio_atual()))
$$;

create or replace function app.derrubar_sessoes(p_usuario uuid) returns void
language sql security definer set search_path = public, app as $$
  delete from sessoes where usuario_id = p_usuario and escritorio_id = app.escritorio_atual()
$$;

-- Assentos: sem assinatura no Stripe, não há limite (beta). Suspensos não contam.
create or replace function app.assentos_em_uso(p_escritorio uuid) returns integer
language sql stable security definer set search_path = public, app as $$
  select (select count(*) from membros where escritorio_id = p_escritorio and suspenso_em is null)::int
       + (select count(*) from convites where escritorio_id = p_escritorio and aceito_em is null
          and cancelado_em is null and expira_em > now() and not aguarda_titular)::int
$$;

create or replace function app.assento_livre(p_escritorio uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select e.stripe_assinatura_id is null or e.assentos is null or app.assentos_em_uso(e.id) < e.assentos
  from escritorios e where e.id = p_escritorio
$$;

-- Muda o nível de alguém. Regras: ninguém muda o próprio; ninguém vira Titular por aqui
-- (só pela transferência); o Titular não é rebaixado; um Admin não promove acima de si
-- e não rebaixa outro Admin. Rebaixar derruba as sessões da pessoa no escritório.
create or replace function app.mudar_nivel(p_usuario uuid, p_nivel nivel_acesso) returns void
language plpgsql security definer set search_path = public, app as $$
declare eu nivel_acesso := app.nivel_atual(); antes nivel_acesso;
begin
  perform app.exigir('gerir_pessoas');
  if p_usuario = app.usuario_atual() then raise exception 'proprio_nivel' using errcode = 'P0001'; end if;
  select nivel into antes from membros where escritorio_id = app.escritorio_atual() and usuario_id = p_usuario;
  if antes is null then raise exception 'nao_e_membro' using errcode = 'P0001'; end if;
  if p_nivel = 'titular' then raise exception 'use_transferencia' using errcode = 'P0001'; end if;
  if antes = 'titular' then raise exception 'titular_intocavel' using errcode = 'P0001'; end if;
  if p_nivel > eu then raise exception 'acima_de_si' using errcode = 'P0001'; end if;
  if eu <> 'titular' and antes >= 'admin' then raise exception 'so_titular_rebaixa_admin' using errcode = 'P0001'; end if;
  if antes = p_nivel then return; end if;
  update membros set nivel = p_nivel where escritorio_id = app.escritorio_atual() and usuario_id = p_usuario;
  if p_nivel < antes then perform app.derrubar_sessoes(p_usuario); end if;
  perform app.auditar('mudanca_nivel', p_usuario, jsonb_build_object('de', antes, 'para', p_nivel));
end $$;

-- Quem pode agir sobre a pessoa: nunca sobre o Titular, nunca sobre si; Admin não age sobre Admin.
create or replace function app.conferir_alvo(p_usuario uuid) returns nivel_acesso
language plpgsql stable security definer set search_path = public, app as $$
declare alvo nivel_acesso;
begin
  perform app.exigir('gerir_pessoas');
  if p_usuario = app.usuario_atual() then raise exception 'proprio_usuario' using errcode = 'P0001'; end if;
  select nivel into alvo from membros where escritorio_id = app.escritorio_atual() and usuario_id = p_usuario;
  if alvo is null then raise exception 'nao_e_membro' using errcode = 'P0001'; end if;
  if alvo = 'titular' then raise exception 'titular_intocavel' using errcode = 'P0001'; end if;
  if app.nivel_atual() <> 'titular' and alvo >= 'admin' then raise exception 'so_titular_age_sobre_admin' using errcode = 'P0001'; end if;
  return alvo;
end $$;

create or replace function app.suspender(p_usuario uuid, p_suspender boolean) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.conferir_alvo(p_usuario);
  if not p_suspender and not app.assento_livre(app.escritorio_atual()) then
    raise exception 'sem_assento' using errcode = 'P0001';
  end if;
  update membros set suspenso_em = case when p_suspender then now() end
  where escritorio_id = app.escritorio_atual() and usuario_id = p_usuario;
  if p_suspender then perform app.derrubar_sessoes(p_usuario); end if;
  perform app.auditar(case when p_suspender then 'suspensao' else 'reativacao' end, p_usuario);
end $$;

-- Saída: o vínculo acaba, a conta continua da pessoa, e as consultas ficam com o escritório.
create or replace function app.desvincular(p_usuario uuid) returns void
language sql security definer set search_path = public, app as $$
  delete from casos_membros cm using casos c
  where cm.caso_id = c.id and c.escritorio_id = app.escritorio_atual() and cm.usuario_id = p_usuario;
  delete from sessoes where usuario_id = p_usuario and escritorio_id = app.escritorio_atual();
  delete from membros where escritorio_id = app.escritorio_atual() and usuario_id = p_usuario;
$$;

create or replace function app.remover_membro(p_usuario uuid) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.conferir_alvo(p_usuario);
  perform app.auditar('remocao', p_usuario);
  perform app.desvincular(p_usuario);
end $$;

create or replace function app.sair_do_escritorio() returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if app.nivel_atual() is null then raise exception 'nao_e_membro' using errcode = 'P0001'; end if;
  if app.nivel_atual() = 'titular' then raise exception 'transfira_antes' using errcode = 'P0001'; end if;
  perform app.auditar('saida');
  perform app.desvincular(app.usuario_atual());
end $$;

create or replace function app.transferir_titularidade(p_usuario uuid) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.exigir('transferir_titularidade');
  if p_usuario = app.usuario_atual() then raise exception 'proprio_usuario' using errcode = 'P0001'; end if;
  if not exists (select 1 from membros m join usuarios u on u.id = m.usuario_id
                 where m.escritorio_id = app.escritorio_atual() and m.usuario_id = p_usuario
                   and m.suspenso_em is null and u.excluido_em is null) then
    raise exception 'nao_e_membro' using errcode = 'P0001';
  end if;
  update membros set nivel = 'admin' where escritorio_id = app.escritorio_atual() and usuario_id = app.usuario_atual();
  update membros set nivel = 'titular' where escritorio_id = app.escritorio_atual() and usuario_id = p_usuario;
  perform app.auditar('transferencia_titularidade', p_usuario);
end $$;

-- ───────────────────────── Convites ─────────────────────────
-- Convite acima dos assentos: o Titular confirma na hora (e a assinatura sobe, proporcional);
-- vindo de um Admin, fica aguardando o Titular e não é enviado.
create or replace function app.criar_convite(p_email text, p_nivel nivel_acesso, p_cargo text, p_token_hash text,
                                             p_confirmar_assento boolean default false)
returns table (id uuid, aguarda_titular boolean)
language plpgsql security definer set search_path = public, app as $$
declare eu nivel_acesso := app.nivel_atual(); espera boolean := false; novo uuid;
begin
  perform app.exigir('gerir_pessoas');
  if p_nivel = 'titular' then raise exception 'use_transferencia' using errcode = 'P0001'; end if;
  if p_nivel > eu then raise exception 'acima_de_si' using errcode = 'P0001'; end if;
  if exists (select 1 from membros m join usuarios u on u.id = m.usuario_id
             where m.escritorio_id = app.escritorio_atual() and u.email = lower(p_email)) then
    raise exception 'ja_e_membro' using errcode = 'P0001';
  end if;
  if not app.assento_livre(app.escritorio_atual()) then
    if eu = 'titular' and not p_confirmar_assento then raise exception 'confirmar_assento' using errcode = 'P0001'; end if;
    espera := eu <> 'titular';
  end if;
  update convites c set cancelado_em = now()
  where c.escritorio_id = app.escritorio_atual() and c.email = lower(p_email) and c.aceito_em is null and c.cancelado_em is null;
  insert into convites (escritorio_id, email, nivel, cargo, token_hash, convidado_por, expira_em, aguarda_titular)
  values (app.escritorio_atual(), lower(p_email), p_nivel, nullif(trim(p_cargo), ''), p_token_hash, app.usuario_atual(),
          now() + interval '7 days', espera)
  returning convites.id into novo;
  perform app.auditar('convite', novo, jsonb_build_object('email', lower(p_email), 'nivel', p_nivel, 'aguarda_titular', espera));
  return query select novo, espera;
end $$;

-- Reenviar troca o token (o link antigo para de valer) e renova os 7 dias.
create or replace function app.reenviar_convite(p_id uuid, p_token_hash text) returns text
language plpgsql security definer set search_path = public, app as $$
declare e text;
begin
  perform app.exigir('gerir_pessoas');
  update convites set token_hash = p_token_hash, expira_em = now() + interval '7 days'
  where id = p_id and escritorio_id = app.escritorio_atual() and aceito_em is null and cancelado_em is null
    and not aguarda_titular
  returning email into e;
  if e is null then raise exception 'convite_invalido' using errcode = 'P0001'; end if;
  perform app.auditar('convite_reenviado', p_id);
  return e;
end $$;

create or replace function app.cancelar_convite(p_id uuid) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.exigir('gerir_pessoas');
  update convites set cancelado_em = now()
  where id = p_id and escritorio_id = app.escritorio_atual() and aceito_em is null and cancelado_em is null;
  if not found then raise exception 'convite_invalido' using errcode = 'P0001'; end if;
  perform app.auditar('convite_cancelado', p_id);
end $$;

-- O Titular libera um convite que um Admin fez acima dos assentos.
create or replace function app.liberar_convite(p_id uuid, p_token_hash text) returns text
language plpgsql security definer set search_path = public, app as $$
declare e text;
begin
  perform app.exigir('gerir_cobranca');
  update convites set aguarda_titular = false, token_hash = p_token_hash, expira_em = now() + interval '7 days'
  where id = p_id and escritorio_id = app.escritorio_atual() and aguarda_titular and aceito_em is null and cancelado_em is null
  returning email into e;
  if e is null then raise exception 'convite_invalido' using errcode = 'P0001'; end if;
  perform app.auditar('convite_liberado', p_id);
  return e;
end $$;

-- Página pública do convite: só mostra o que o convidado precisa saber.
create or replace function app.convite_por_token(p_token_hash text)
returns table (escritorio text, email text, nivel nivel_acesso, cargo text, expira_em timestamptz, convidado_por text, tem_conta boolean,
               escritorio_id uuid)
language sql stable security definer set search_path = public, app as $$
  select e.nome, c.email, c.nivel, c.cargo, c.expira_em, u.nome,
         exists (select 1 from usuarios x where x.email = c.email and x.excluido_em is null), e.id
  from convites c join escritorios e on e.id = c.escritorio_id join usuarios u on u.id = c.convidado_por
  where c.token_hash = p_token_hash and c.aceito_em is null and c.cancelado_em is null
    and not c.aguarda_titular and c.expira_em > now() and e.encerrado_em is null
$$;

-- Aceite por quem já tem conta (usuário no contexto, e-mail igual ao convidado). Vale uma vez.
create or replace function app.aceitar_convite(p_token_hash text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare c convites; meu_email text;
begin
  select email into meu_email from usuarios where id = app.usuario_atual() and excluido_em is null;
  select * into c from convites x
  where x.token_hash = p_token_hash and x.aceito_em is null and x.cancelado_em is null and not x.aguarda_titular and x.expira_em > now()
  for update;
  if c.id is null then raise exception 'convite_invalido' using errcode = 'P0001'; end if;
  if meu_email is distinct from c.email then raise exception 'convite_de_outro_email' using errcode = 'P0001'; end if;
  insert into membros (escritorio_id, usuario_id, nivel, cargo) values (c.escritorio_id, app.usuario_atual(), c.nivel, c.cargo)
  on conflict do nothing;
  update convites set aceito_em = now(), aceito_por = app.usuario_atual() where id = c.id;
  insert into auditoria (escritorio_id, usuario_id, acao, alvo_id, detalhes)
  values (c.escritorio_id, app.usuario_atual(), 'aceite_convite', c.id, jsonb_build_object('nivel', c.nivel));
  return c.escritorio_id;
end $$;

-- Aceite por quem ainda não tem conta: cria a conta com o e-mail do convite.
create or replace function app.cadastrar_por_convite(p_token_hash text, p_nome text, p_senha_hash text)
returns table (usuario_id uuid, escritorio_id uuid)
language plpgsql security definer set search_path = public, app as $$
declare c convites; u uuid;
begin
  select * into c from convites x
  where x.token_hash = p_token_hash and x.aceito_em is null and x.cancelado_em is null and not x.aguarda_titular and x.expira_em > now()
  for update;
  if c.id is null then raise exception 'convite_invalido' using errcode = 'P0001'; end if;
  if exists (select 1 from usuarios where email = c.email) then raise exception 'email_em_uso' using errcode = 'P0001'; end if;
  insert into usuarios (email, nome, senha_hash) values (c.email, p_nome, p_senha_hash) returning id into u;
  insert into membros (escritorio_id, usuario_id, nivel, cargo) values (c.escritorio_id, u, c.nivel, c.cargo);
  update convites set aceito_em = now(), aceito_por = u where id = c.id;
  insert into auditoria (escritorio_id, usuario_id, acao, alvo_id, detalhes)
  values (c.escritorio_id, u, 'aceite_convite', c.id, jsonb_build_object('nivel', c.nivel, 'conta_nova', true));
  return query select u, c.escritorio_id;
end $$;

-- ───────────────────────── Domínio do escritório ─────────────────────────
-- Só quem tem e-mail no domínio pode declará-lo como do escritório.
create or replace function app.conferir_dominio() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if new.dominio_email is distinct from old.dominio_email and new.dominio_email is not null
     and not exists (select 1 from usuarios where id = app.usuario_atual() and email like '%@' || new.dominio_email) then
    raise exception 'dominio_de_outro_email' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger escritorios_dominio before update of dominio_email on escritorios
  for each row execute function app.conferir_dominio();

create or replace function app.escritorio_do_dominio(p_email text) returns table (escritorio_id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select id, nome from escritorios
  where dominio_email = split_part(lower(p_email), '@', 2) and encerrado_em is null
$$;

create or replace function app.cadastrar_pedindo_entrada(p_email text, p_nome text, p_senha_hash text, p_escritorio uuid)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare u uuid;
begin
  if not exists (select 1 from app.escritorio_do_dominio(p_email) d where d.escritorio_id = p_escritorio) then
    raise exception 'dominio_diferente' using errcode = 'P0001';
  end if;
  if exists (select 1 from usuarios where email = lower(p_email)) then raise exception 'email_em_uso' using errcode = 'P0001'; end if;
  insert into usuarios (email, nome, senha_hash) values (lower(p_email), p_nome, p_senha_hash) returning id into u;
  insert into pedidos_entrada (escritorio_id, usuario_id) values (p_escritorio, u);
  insert into auditoria (escritorio_id, usuario_id, acao) values (p_escritorio, u, 'pedido_entrada');
  return u;
end $$;

create or replace function app.pedidos_pendentes()
returns table (id uuid, usuario_id uuid, nome text, email text, criado_em timestamptz)
language sql stable security definer set search_path = public, app as $$
  select p.id, u.id, u.nome, u.email, p.criado_em
  from pedidos_entrada p join usuarios u on u.id = p.usuario_id and u.excluido_em is null
  where p.escritorio_id = app.escritorio_atual() and p.decidido_em is null and app.pode('gerir_pessoas')
  order by p.criado_em
$$;

create or replace function app.decidir_entrada(p_id uuid, p_aprovar boolean, p_nivel nivel_acesso, p_cargo text) returns void
language plpgsql security definer set search_path = public, app as $$
declare p pedidos_entrada;
begin
  perform app.exigir('gerir_pessoas');
  select * into p from pedidos_entrada where id = p_id and escritorio_id = app.escritorio_atual() and decidido_em is null for update;
  if p.id is null then raise exception 'pedido_invalido' using errcode = 'P0001'; end if;
  if p_aprovar then
    if p_nivel = 'titular' then raise exception 'use_transferencia' using errcode = 'P0001'; end if;
    if p_nivel > app.nivel_atual() then raise exception 'acima_de_si' using errcode = 'P0001'; end if;
    if not app.assento_livre(app.escritorio_atual()) then raise exception 'sem_assento' using errcode = 'P0001'; end if;
    insert into membros (escritorio_id, usuario_id, nivel, cargo) values (p.escritorio_id, p.usuario_id, p_nivel, nullif(trim(p_cargo), ''));
  end if;
  update pedidos_entrada set decidido_em = now(), decidido_por = app.usuario_atual(), aprovado = p_aprovar where id = p_id;
  perform app.auditar(case when p_aprovar then 'entrada_aprovada' else 'entrada_recusada' end, p.usuario_id,
                      jsonb_build_object('nivel', case when p_aprovar then p_nivel end));
end $$;

-- ───────────────────────── Casos: inclusão e revisão ─────────────────────────
create or replace function app.incluir_no_caso(p_caso uuid, p_usuario uuid) returns text
language plpgsql security definer set search_path = public, app as $$
begin
  if not app.caso_visivel(p_caso) then raise exception 'caso_invalido' using errcode = 'P0001'; end if;
  if not exists (select 1 from membros where escritorio_id = app.escritorio_atual() and usuario_id = p_usuario and suspenso_em is null) then
    raise exception 'nao_e_membro' using errcode = 'P0001';
  end if;
  if app.pode('incluir_colega') then
    insert into casos_membros (caso_id, usuario_id, incluido_por) values (p_caso, p_usuario, app.usuario_atual()) on conflict do nothing;
    perform app.auditar('inclusao_caso', p_caso, jsonb_build_object('usuario', p_usuario));
    return 'incluido';
  elsif app.pede_revisao('incluir_colega') then
    if not exists (select 1 from revisoes where escritorio_id = app.escritorio_atual() and acao = 'incluir_colega' and status = 'pendente'
                     and alvo = jsonb_build_object('caso', p_caso, 'usuario', p_usuario)) then
      insert into revisoes (escritorio_id, solicitante, acao, alvo)
      values (app.escritorio_atual(), app.usuario_atual(), 'incluir_colega', jsonb_build_object('caso', p_caso, 'usuario', p_usuario));
      perform app.auditar('pedido_revisao', p_caso, jsonb_build_object('acao', 'incluir_colega', 'usuario', p_usuario));
    end if;
    return 'revisao';
  end if;
  raise exception 'sem_permissao' using errcode = 'P0001';
end $$;

create or replace function app.retirar_do_caso(p_caso uuid, p_usuario uuid) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if not exists (select 1 from casos where id = p_caso and escritorio_id = app.escritorio_atual() and app.caso_visivel(id)
                   and (criado_por = app.usuario_atual() or app.nivel_atual() >= 'admin')) then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;
  delete from casos_membros where caso_id = p_caso and usuario_id = p_usuario;
  perform app.auditar('retirada_caso', p_caso, jsonb_build_object('usuario', p_usuario));
end $$;

-- Exportar parecer: livre a partir de Membro; o Supervisionado pede revisão e, aprovada, exporta.
create or replace function app.pedir_exportacao(p_consulta uuid, p_formato text) returns text
language plpgsql security definer set search_path = public, app as $$
declare v_alvo jsonb := jsonb_build_object('consulta', p_consulta);
begin
  if not exists (select 1 from consultas c where c.id = p_consulta and c.escritorio_id = app.escritorio_atual()
                   and (c.usuario_id = app.usuario_atual() or (c.caso_id is null and app.nivel_atual() >= c.nivel_minimo)
                        or (c.caso_id is not null and app.caso_visivel(c.caso_id)))) then
    raise exception 'consulta_invalida' using errcode = 'P0001';
  end if;
  if app.pode('exportar_parecer')
     or (app.pede_revisao('exportar_parecer') and exists (select 1 from revisoes where escritorio_id = app.escritorio_atual()
           and solicitante = app.usuario_atual() and acao = 'exportar_parecer' and alvo = v_alvo and status = 'aprovada')) then
    perform app.auditar('exportacao_parecer', p_consulta, jsonb_build_object('formato', p_formato));
    return 'liberado';
  elsif app.pede_revisao('exportar_parecer') then
    if exists (select 1 from revisoes r where r.escritorio_id = app.escritorio_atual() and r.solicitante = app.usuario_atual()
                 and r.acao = 'exportar_parecer' and r.alvo = v_alvo and r.status = 'pendente') then
      return 'pendente';
    end if;
    insert into revisoes (escritorio_id, solicitante, acao, alvo) values (app.escritorio_atual(), app.usuario_atual(), 'exportar_parecer', v_alvo);
    perform app.auditar('pedido_revisao', p_consulta, jsonb_build_object('acao', 'exportar_parecer'));
    return 'revisao';
  end if;
  raise exception 'sem_permissao' using errcode = 'P0001';
end $$;

create or replace function app.decidir_revisao(p_id uuid, p_aprovar boolean, p_nota text) returns void
language plpgsql security definer set search_path = public, app as $$
declare r revisoes;
begin
  if coalesce(app.nivel_atual() < 'membro', true) then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  select * into r from revisoes where id = p_id and escritorio_id = app.escritorio_atual() and status = 'pendente' for update;
  if r.id is null then raise exception 'revisao_invalida' using errcode = 'P0001'; end if;
  if r.solicitante = app.usuario_atual() then raise exception 'propria_revisao' using errcode = 'P0001'; end if;
  update revisoes set status = case when p_aprovar then 'aprovada' else 'recusada' end, revisor = app.usuario_atual(),
                      nota = nullif(trim(p_nota), ''), decidido_em = now()
  where id = p_id;
  if p_aprovar and r.acao = 'incluir_colega' then
    insert into casos_membros (caso_id, usuario_id, incluido_por)
    select (r.alvo->>'caso')::uuid, (r.alvo->>'usuario')::uuid, app.usuario_atual()
    where exists (select 1 from casos where id = (r.alvo->>'caso')::uuid and escritorio_id = app.escritorio_atual())
      and exists (select 1 from membros where escritorio_id = app.escritorio_atual() and usuario_id = (r.alvo->>'usuario')::uuid)
    on conflict do nothing;
  end if;
  perform app.auditar(case when p_aprovar then 'revisao_aprovada' else 'revisao_recusada' end, p_id,
                      jsonb_build_object('acao', r.acao, 'solicitante', r.solicitante));
end $$;

-- Dispositivos citados numa consulta visível, para montar o parecer (com o status de curadoria,
-- que o parecer mostra). Só os da própria consulta: não serve para ler a base em rascunho.
create or replace function app.fontes_da_consulta(p_consulta uuid)
returns table (id uuid, norma text, url_oficial text, rotulo text, texto text, vigencia_inicio date, vigencia_fim date,
               status_curadoria text, origem text)
language sql stable security definer set search_path = public, app as $$
  select d.id, n.tipo || ' ' || n.numero || '/' || n.ano, n.url_oficial, d.rotulo, d.texto, d.vigencia_inicio, d.vigencia_fim,
         d.status_curadoria, d.origem
  from consultas c
  cross join lateral jsonb_array_elements(c.citacoes) cit
  join dispositivos d on d.id = (cit->>'dispositivo_id')::uuid
  join normas n on n.id = d.norma_id
  where c.id = p_consulta and c.escritorio_id = app.escritorio_atual() and app.nivel_atual() is not null
    and (c.usuario_id = app.usuario_atual() or (c.caso_id is null and app.nivel_atual() >= c.nivel_minimo)
         or (c.caso_id is not null and app.caso_visivel(c.caso_id)))
  group by d.id, n.tipo, n.numero, n.ano, n.url_oficial
$$;

-- ───────────────────────── Consumo, cobrança e Stripe ─────────────────────────
create or replace function app.consumo(p_meses integer)
returns table (mes date, usuario_id uuid, nome text, consultas integer, custo_microreais bigint)
language sql stable security definer set search_path = public, app as $$
  select date_trunc('month', c.criado_em)::date, c.usuario_id,
         case when u.excluido_em is not null then 'ex-membro' else u.nome end,
         count(*)::int, coalesce(sum(c.custo_microreais), 0)::bigint
  from consultas c join usuarios u on u.id = c.usuario_id
  where c.escritorio_id = app.escritorio_atual() and app.pode('ver_consumo')
    and c.criado_em >= date_trunc('month', now()) - make_interval(months => greatest(0, least(p_meses, 24) - 1))
  group by 1, 2, 3
  order by 1 desc, 4 desc
$$;

create or replace function app.cobranca()
returns table (plano text, assentos integer, em_uso integer, stripe_cliente_id text, stripe_assinatura_id text, assinatura_status text)
language sql stable security definer set search_path = public, app as $$
  select e.plano, e.assentos, app.assentos_em_uso(e.id), e.stripe_cliente_id, e.stripe_assinatura_id, e.assinatura_status
  from escritorios e where e.id = app.escritorio_atual() and app.pode('gerir_cobranca')
$$;

create or replace function app.stripe_vincular_cliente(p_cliente text) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.exigir('gerir_cobranca');
  update escritorios set stripe_cliente_id = p_cliente where id = app.escritorio_atual() and stripe_cliente_id is null;
end $$;

-- Chamado pelo webhook do Stripe (assinatura conferida na aplicação). Só atualiza a assinatura.
create or replace function app.stripe_sincronizar(p_cliente text, p_assinatura text, p_status text, p_assentos integer, p_plano text)
returns void language plpgsql security definer set search_path = public, app as $$
declare e uuid;
begin
  update escritorios set stripe_assinatura_id = case when p_status in ('canceled', 'incomplete_expired') then null else p_assinatura end,
                         assinatura_status = p_status,
                         assentos = case when p_status in ('canceled', 'incomplete_expired') then null else greatest(1, p_assentos) end,
                         plano = coalesce(p_plano, plano)
  where stripe_cliente_id = p_cliente
  returning id into e;
  if e is not null then
    insert into auditoria (escritorio_id, usuario_id, acao, detalhes)
    values (e, null, 'assinatura', jsonb_build_object('status', p_status, 'assentos', p_assentos, 'plano', p_plano));
  end if;
end $$;

-- Auditoria de mudança de plano pedida pelo Titular (o efeito vem pelo webhook).
create or replace function app.registrar_cobranca(p_acao text, p_detalhes jsonb) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.exigir('gerir_cobranca');
  perform app.auditar(p_acao, null, p_detalhes);
end $$;

-- ───────────────────────── Dados e encerramento ─────────────────────────
create or replace function app.exportar_escritorio() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare e uuid := app.escritorio_atual(); r jsonb;
begin
  perform app.exigir('exportar_escritorio');
  select jsonb_build_object(
    'gerado_em', now(),
    'escritorio', (select to_jsonb(x) - 'stripe_cliente_id' - 'stripe_assinatura_id' from escritorios x where x.id = e),
    'membros', coalesce((select jsonb_agg(jsonb_build_object('usuario_id', u.id, 'nome', u.nome, 'email', u.email, 'cargo', m.cargo,
                 'nivel', m.nivel, 'desde', m.criado_em, 'suspenso_em', m.suspenso_em)) from membros m join usuarios u on u.id = m.usuario_id
                 where m.escritorio_id = e), '[]'),
    'casos', coalesce((select jsonb_agg(to_jsonb(x)) from casos x where x.escritorio_id = e), '[]'),
    'casos_membros', coalesce((select jsonb_agg(to_jsonb(x)) from casos_membros x join casos c on c.id = x.caso_id where c.escritorio_id = e), '[]'),
    'consultas', coalesce((select jsonb_agg(to_jsonb(x)) from consultas x where x.escritorio_id = e), '[]'),
    'simulacoes', coalesce((select jsonb_agg(to_jsonb(x)) from simulacoes x where x.escritorio_id = e), '[]'),
    'documentos_privados', coalesce((select jsonb_agg(to_jsonb(x)) from documentos_privados x where x.escritorio_id = e), '[]'),
    'revisoes', coalesce((select jsonb_agg(to_jsonb(x)) from revisoes x where x.escritorio_id = e), '[]'),
    'convites', coalesce((select jsonb_agg(to_jsonb(x) - 'token_hash') from convites x where x.escritorio_id = e), '[]'),
    'auditoria', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from auditoria x where x.escritorio_id = e), '[]')
  ) into r;
  perform app.auditar('exportacao_escritorio');
  return r;
end $$;

create or replace function app.exportar_meus_dados() returns jsonb
language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object(
    'gerado_em', now(),
    'perfil', (select to_jsonb(u) - 'senha_hash' - 'totp_segredo_cifrado' - 'codigos_recuperacao' - 'totp_ultimo_passo'
               from usuarios u where u.id = app.usuario_atual()),
    'vinculos', coalesce((select jsonb_agg(jsonb_build_object('escritorio', e.nome, 'cargo', m.cargo, 'nivel', m.nivel, 'desde', m.criado_em))
                 from membros m join escritorios e on e.id = m.escritorio_id where m.usuario_id = app.usuario_atual()), '[]'),
    'sessoes', coalesce((select jsonb_agg(jsonb_build_object('aparelho', s.aparelho, 'cidade', s.cidade, 'criada_em', s.criada_em,
                 'ultimo_uso_em', s.ultimo_uso_em)) from sessoes s where s.usuario_id = app.usuario_atual()), '[]'),
    'minhas_acoes', coalesce((select jsonb_agg(jsonb_build_object('acao', a.acao, 'em', a.criado_em, 'detalhes', a.detalhes) order by a.id)
                 from auditoria a where a.usuario_id = app.usuario_atual()), '[]'),
    'pedidos_exclusao', coalesce((select jsonb_agg(to_jsonb(p)) from pedidos_exclusao p where p.usuario_id = app.usuario_atual()), '[]')
  )
$$;

-- Encerramento com carência de 30 dias: só o Titular entra, para exportar ou reabrir.
create or replace function app.encerrar_escritorio() returns timestamptz
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.exigir('encerrar_escritorio');
  update escritorios set encerrado_em = now() where id = app.escritorio_atual() and encerrado_em is null;
  delete from sessoes where escritorio_id = app.escritorio_atual() and usuario_id <> app.usuario_atual();
  update convites set cancelado_em = now() where escritorio_id = app.escritorio_atual() and aceito_em is null and cancelado_em is null;
  perform app.auditar('encerramento');
  return now() + interval '30 days';
end $$;

create or replace function app.reabrir_escritorio() returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.exigir('encerrar_escritorio');
  update escritorios set encerrado_em = null where id = app.escritorio_atual() and encerrado_em > now() - interval '30 days';
  if not found then raise exception 'fora_da_carencia' using errcode = 'P0001'; end if;
  perform app.auditar('reabertura');
end $$;

-- Exclusão de conta (LGPD, art. 18): lógica na hora, física pelo expurgo em até 15 dias.
create or replace function app.pedir_exclusao_conta() returns timestamptz
language plpgsql security definer set search_path = public, app as $$
declare u usuarios; v record;
begin
  select * into u from usuarios where id = app.usuario_atual() and excluido_em is null;
  if u.id is null then raise exception 'sem_usuario' using errcode = 'P0001'; end if;
  if exists (select 1 from membros m join escritorios e on e.id = m.escritorio_id
             where m.usuario_id = u.id and m.nivel = 'titular' and e.encerrado_em is null) then
    raise exception 'transfira_antes' using errcode = 'P0001';
  end if;
  for v in select escritorio_id from membros where usuario_id = u.id loop
    insert into auditoria (escritorio_id, usuario_id, acao) values (v.escritorio_id, u.id, 'exclusao_conta');
  end loop;
  delete from casos_membros where usuario_id = u.id;
  delete from membros where usuario_id = u.id;
  delete from sessoes where usuario_id = u.id;
  update usuarios set excluido_em = now() where id = u.id;
  insert into pedidos_exclusao (usuario_id, email, prazo_em) values (u.id, u.email, now() + interval '15 days');
  return now() + interval '15 days';
end $$;

-- Expurgo, rodado diariamente pelo dono das tabelas (scripts/expurgo.mjs).
-- Contas excluídas: os dados pessoais saem; a linha fica como "ex-membro" para as
-- consultas que pertencem aos escritórios. Escritórios encerrados há 30 dias: apagados.
create or replace function app.expurgar() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare contas integer; escs integer;
begin
  update usuarios set nome = 'ex-membro', email = 'excluido-' || id || '@excluido.invalid', senha_hash = null,
                      oab_numero = null, oab_uf = null, oab_verificada_em = null, foto_url = null,
                      totp_segredo_cifrado = null, totp_ativado_em = null, totp_ultimo_passo = null,
                      codigos_recuperacao = '{}', preferencias = '{}', anonimizado_em = now()
  where excluido_em is not null and anonimizado_em is null;
  get diagnostics contas = row_count;
  update pedidos_exclusao p set concluido_em = now()
  from usuarios u where u.id = p.usuario_id and u.anonimizado_em is not null and p.concluido_em is null;
  update pedidos_exclusao set email = 'expurgado' where concluido_em is not null and email <> 'expurgado';
  delete from escritorios where encerrado_em < now() - interval '30 days';
  get diagnostics escs = row_count;
  delete from sessoes where expira_em < now();
  delete from desafios_2fa where expira_em < now();
  delete from trocas_email where expira_em < now() - interval '7 days';
  return jsonb_build_object('contas_anonimizadas', contas, 'escritorios_apagados', escs);
end $$;

-- ───────────────────────── Plataforma: suporte, curadoria e LGPD ─────────────────────────
create or replace function app.papel_plataforma() returns text
language sql stable security definer set search_path = public, app as $$
  select papel from equipe_plataforma where usuario_id = app.usuario_atual()
$$;

create or replace function app.exigir_plataforma(p_papeis text[]) returns void
language plpgsql stable security definer set search_path = public, app as $$
begin
  if coalesce(app.papel_plataforma() = 'admin' or app.papel_plataforma() = any (p_papeis), false) is not true then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;
end $$;

-- Suporte vê escritórios e assinaturas, nunca o conteúdo das consultas.
create or replace function app.plat_escritorios()
returns table (id uuid, nome text, plano text, assinatura_status text, assentos integer, membros integer,
               consultas_30d integer, criado_em timestamptz, encerrado_em timestamptz, titular text)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array['suporte']);
  return query
  select e.id, e.nome, e.plano, e.assinatura_status, e.assentos,
         (select count(*) from membros m where m.escritorio_id = e.id and m.suspenso_em is null)::int,
         (select count(*) from consultas c where c.escritorio_id = e.id and c.criado_em > now() - interval '30 days')::int,
         e.criado_em, e.encerrado_em,
         (select u.email from membros m join usuarios u on u.id = m.usuario_id where m.escritorio_id = e.id and m.nivel = 'titular')
  from escritorios e order by e.criado_em desc;
end $$;

-- Fila do curador: rascunhos e em revisão, com o texto ingerido do Planalto ao lado quando houver.
create or replace function app.plat_curadoria_fila()
returns table (id uuid, norma text, url_oficial text, rotulo text, texto text, origem text, status_curadoria text,
               vigencia_inicio date, vigencia_fim date, nota text, texto_planalto text)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array['curador']);
  return query
  select d.id, n.tipo || ' ' || n.numero || '/' || n.ano, n.url_oficial, d.rotulo, d.texto, d.origem, d.status_curadoria,
         d.vigencia_inicio, d.vigencia_fim, d.nota_curadoria,
         (select o.texto from dispositivos o where o.norma_id = d.norma_id and o.rotulo = d.rotulo and o.origem = 'ingestao'
            and o.id <> d.id order by o.vigencia_inicio desc limit 1)
  from dispositivos d join normas n on n.id = d.norma_id
  where d.status_curadoria in ('rascunho', 'em_revisao')
  order by n.ano, n.numero, d.rotulo;
end $$;

create or replace function app.plat_curadoria_decidir(p_id uuid, p_status text, p_nota text) returns void
language plpgsql security definer set search_path = public, app as $$
declare antes text;
begin
  perform app.exigir_plataforma(array['curador']);
  if p_status not in ('publicado', 'rejeitado', 'em_revisao') then raise exception 'status_invalido' using errcode = 'P0001'; end if;
  select status_curadoria into antes from dispositivos where id = p_id for update;
  if antes is null then raise exception 'dispositivo_invalido' using errcode = 'P0001'; end if;
  update dispositivos set status_curadoria = p_status, nota_curadoria = coalesce(nullif(trim(p_nota), ''), nota_curadoria),
                          revisado_por = app.usuario_atual(), revisado_em = now()
  where id = p_id;
  insert into curadoria_eventos (dispositivo_id, usuario_id, de, para, nota) values (p_id, app.usuario_atual(), antes, p_status, nullif(trim(p_nota), ''));
end $$;

create or replace function app.plat_pedidos_exclusao()
returns table (id uuid, email text, solicitado_em timestamptz, prazo_em timestamptz, concluido_em timestamptz)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array['suporte']);
  return query select p.id, p.email, p.solicitado_em, coalesce(p.prazo_em, p.solicitado_em + interval '15 days'), p.concluido_em
               from pedidos_exclusao p order by p.concluido_em nulls first, p.solicitado_em;
end $$;

-- OAB: declarada pela pessoa, conferida à mão pela equipe (decisão 4 em aberto).
create or replace function app.plat_oab_pendentes()
returns table (usuario_id uuid, nome text, email text, oab text, criado_em timestamptz)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array['suporte']);
  return query select u.id, u.nome, u.email, u.oab_numero || '/' || u.oab_uf, u.criado_em
               from usuarios u where u.oab_numero is not null and u.oab_verificada_em is null and u.excluido_em is null
               order by u.criado_em;
end $$;

create or replace function app.plat_oab_verificar(p_usuario uuid) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array['suporte']);
  update usuarios set oab_verificada_em = now() where id = p_usuario and oab_numero is not null;
end $$;

create or replace function app.plat_equipe() returns table (usuario_id uuid, nome text, email text, papel text)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array[]::text[]);
  return query select u.id, u.nome, u.email, p.papel from equipe_plataforma p join usuarios u on u.id = p.usuario_id order by p.papel, u.nome;
end $$;

-- Só o admin da plataforma nomeia a equipe. O primeiro admin entra por SQL (docs/DEPLOY.md).
create or replace function app.plat_definir_papel(p_email text, p_papel text) returns void
language plpgsql security definer set search_path = public, app as $$
declare u uuid;
begin
  perform app.exigir_plataforma(array[]::text[]);
  select id into u from usuarios where email = lower(p_email) and excluido_em is null;
  if u is null then raise exception 'sem_usuario' using errcode = 'P0001'; end if;
  if u = app.usuario_atual() then raise exception 'proprio_usuario' using errcode = 'P0001'; end if;
  if p_papel is null then delete from equipe_plataforma where usuario_id = u;
  else insert into equipe_plataforma (usuario_id, papel) values (u, p_papel) on conflict (usuario_id) do update set papel = excluded.papel;
  end if;
end $$;

-- ───────────────────────── Registro de tratamento (LGPD, art. 37) ─────────────────────────
insert into registro_tratamento (operacao, finalidade, base_legal, dados, retencao) values
  ('Convites da equipe', 'Dar acesso ao escritório a quem o Titular ou um Admin convidou',
   'Execução de contrato (art. 7º, V)', 'E-mail do convidado, nível, cargo, quem convidou', '7 dias pendente; depois, histórico do escritório'),
  ('Verificação em duas etapas', 'Proteger o acesso à conta',
   'Execução de contrato (art. 7º, V) e segurança (art. 46)', 'Segredo TOTP cifrado, códigos de recuperação em hash', 'Enquanto ativo; apagado ao desativar ou excluir a conta'),
  ('Sessões', 'Manter o login e permitir encerrar acessos', 'Execução de contrato (art. 7º, V)',
   'Aparelho, cidade aproximada, horários de uso', 'Até expirar ou ser encerrada'),
  ('Cobrança', 'Cobrar a assinatura por pessoa', 'Execução de contrato (art. 7º, V)',
   'Identificadores do cliente e da assinatura no Stripe; o cartão fica só no Stripe', 'Enquanto houver assinatura e pelo prazo fiscal'),
  ('Auditoria administrativa', 'Registrar convites, níveis, remoções, exportações, titularidade e plano',
   'Legítimo interesse e cumprimento de obrigação (art. 7º, II e IX)', 'Quem fez, o quê, quando e sobre quem', 'Enquanto existir o escritório');

-- ───────────────────────── Permissões do papel da aplicação ─────────────────────────
revoke insert, update, delete on escritorios, membros from app_user;
grant select on escritorios, membros to app_user;
grant update (nome, logo_url, dominio_email, exige_2fa, sessao_horas) on escritorios to app_user;
grant update (cargo) on membros to app_user;

revoke update on casos from app_user;
grant update (titulo, cliente) on casos to app_user;
revoke update on consultas from app_user;
grant update (status, resposta, citacoes, motivo_bloqueio, modelo, tokens_entrada, tokens_saida, custo_microreais,
              ms_primeira_palavra, ms_total) on consultas to app_user;
revoke update on simulacoes from app_user;
grant update (titulo, entrada, resultado) on simulacoes to app_user;

grant select on convites, pedidos_entrada, casos_membros, revisoes to app_user;
grant select on registro_tratamento to app_user;
grant select on app.permissoes to app_user;
grant execute on all functions in schema app to app_user;
-- O expurgo é do dono das tabelas (scripts/expurgo.mjs). Funções nascem executáveis por PUBLIC.
revoke execute on function app.expurgar() from public, app_user;

commit;
