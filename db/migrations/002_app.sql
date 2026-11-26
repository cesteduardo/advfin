-- AdvFin — fase 2: login, sessões, busca na base normativa e registro das consultas.
-- Rode como dono das tabelas com BYPASSRLS (superusuário, ou o papel postgres do Supabase):
-- as funções security definer abaixo criam escritório e vínculo antes de existir contexto.
-- O papel app_user continua sem acesso direto a usuarios e sessoes: tudo passa por
-- funções security definer estreitas, que devolvem só o necessário.

-- ───────────────────────── Credenciais e sessões ─────────────────────────
alter table usuarios add column if not exists senha_hash text;

create table if not exists sessoes (
  token_hash    text primary key,            -- sha256 do token do cookie; o token em si nunca é gravado
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  criada_em     timestamptz not null default now(),
  expira_em     timestamptz not null
);
create index if not exists sessoes_usuario on sessoes (usuario_id);
alter table sessoes enable row level security;
alter table sessoes force row level security;   -- sem política: app_user não lê nem grava direto

-- Cadastro: cria usuário, escritório e vínculo de sócio numa só transação.
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
  insert into membros (escritorio_id, usuario_id, papel) values (e, u, 'socio');
  insert into auditoria (escritorio_id, usuario_id, acao) values (e, u, 'cadastro');
  return query select u, e;
end $$;

-- Login: devolve o hash para conferência na aplicação e o primeiro escritório do usuário.
create or replace function app.credenciais(p_email text)
returns table (usuario_id uuid, senha_hash text, escritorio_id uuid)
language sql stable security definer set search_path = public as $$
  select u.id, u.senha_hash,
         (select m.escritorio_id from membros m where m.usuario_id = u.id order by m.criado_em limit 1)
  from usuarios u
  where u.email = lower(p_email) and u.excluido_em is null
$$;

create or replace function app.criar_sessao(p_token_hash text, p_usuario uuid, p_escritorio uuid, p_dias integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from membros where usuario_id = p_usuario and escritorio_id = p_escritorio) then
    raise exception 'sem_vinculo' using errcode = 'P0001';
  end if;
  delete from sessoes where usuario_id = p_usuario and expira_em < now();
  insert into sessoes (token_hash, usuario_id, escritorio_id, expira_em)
  values (p_token_hash, p_usuario, p_escritorio, now() + make_interval(days => p_dias));
end $$;

create or replace function app.resolver_sessao(p_token_hash text)
returns table (usuario_id uuid, escritorio_id uuid, nome text, email text, escritorio text, papel papel_escritorio)
language sql stable security definer set search_path = public as $$
  select s.usuario_id, s.escritorio_id, u.nome, u.email, e.nome, m.papel
  from sessoes s
  join usuarios u on u.id = s.usuario_id and u.excluido_em is null
  join escritorios e on e.id = s.escritorio_id
  join membros m on m.usuario_id = s.usuario_id and m.escritorio_id = s.escritorio_id
  where s.token_hash = p_token_hash and s.expira_em > now()
$$;

create or replace function app.encerrar_sessao(p_token_hash text)
returns void language sql security definer set search_path = public as $$
  delete from sessoes where token_hash = p_token_hash
$$;

-- ───────────────────────── Base normativa: origem e busca ─────────────────────────
-- origem: 'ingestao' (texto baixado da fonte oficial) ou 'semente' (transcrição provisória
-- para desenvolvimento, nunca conferida). A interface mostra as duas coisas.
alter table dispositivos add column if not exists origem text not null default 'ingestao'
  check (origem in ('ingestao', 'semente'));
alter table dispositivos add column if not exists busca tsvector
  generated always as (to_tsvector('portuguese', rotulo || ' ' || texto)) stored;
create index if not exists dispositivos_busca on dispositivos using gin (busca);

-- Pesquisa: dispositivos vigentes na data que respondem aos termos.
-- p_incluir_nao_revisados = true só em desenvolvimento ou beta sem curador; cada linha
-- volta com o status, e a interface marca o que não foi conferido.
create or replace function pesquisar_dispositivos(p_termos text, p_data date, p_limite integer, p_incluir_nao_revisados boolean)
returns table (
  id uuid, norma_tipo text, norma_numero text, norma_ano integer, norma_ementa text, url_oficial text,
  rotulo text, texto text, vigencia_inicio date, vigencia_fim date, status_curadoria text, origem text, relevancia real
)
language sql stable security definer set search_path = public as $$
  with q as (
    select websearch_to_tsquery('portuguese', p_termos) as estrita,
           -- consulta ampla: qualquer termo serve (OR), para perguntas em linguagem natural
           to_tsquery('portuguese', coalesce(nullif(array_to_string(
             array(select quote_literal(lexeme) from unnest(to_tsvector('portuguese', p_termos))), ' | '), ''), '''_''')) as ampla
  )
  select d.id, n.tipo, n.numero, n.ano, n.ementa, n.url_oficial,
         d.rotulo, d.texto, d.vigencia_inicio, d.vigencia_fim, d.status_curadoria, d.origem,
         (ts_rank_cd(d.busca, q.estrita) * 2 + ts_rank_cd(d.busca, q.ampla))::real
  from dispositivos d join normas n on n.id = d.norma_id, q
  where (d.status_curadoria = 'publicado'
         or (p_incluir_nao_revisados and d.status_curadoria in ('rascunho', 'em_revisao')))
    and d.vigencia_inicio <= p_data
    and (d.vigencia_fim is null or d.vigencia_fim > p_data)
    and (d.busca @@ q.estrita or d.busca @@ q.ampla)
  order by 13 desc
  limit greatest(1, least(p_limite, 20))
$$;

-- ───────────────────────── Consultas: citações e bloqueio ─────────────────────────
alter table consultas add column if not exists citacoes jsonb not null default '[]';
alter table consultas add column if not exists motivo_bloqueio text;

-- Simulações salvas (entrada e resultado do motor determinístico).
create table if not exists simulacoes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  caso_id       uuid references casos(id) on delete set null,
  usuario_id    uuid not null references usuarios(id),
  tipo          text not null check (tipo in ('linha_do_tempo', 'comparador', 'apuracao')),
  titulo        text not null,
  entrada       jsonb not null,
  resultado     jsonb not null,
  criado_em     timestamptz not null default now()
);
alter table simulacoes enable row level security;
alter table simulacoes force row level security;
create policy simulacoes_isoladas on simulacoes
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual())
  with check (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual());

-- ───────────────────────── Permissões ─────────────────────────
grant execute on function app.cadastrar(text, text, text, text), app.credenciais(text),
  app.criar_sessao(text, uuid, uuid, integer), app.resolver_sessao(text), app.encerrar_sessao(text) to app_user;
grant execute on function pesquisar_dispositivos(text, date, integer, boolean) to app_user;
grant select, insert, update, delete on simulacoes to app_user;
