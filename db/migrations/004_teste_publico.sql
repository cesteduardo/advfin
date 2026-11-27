-- AdvFin: o que falta para o teste público.
--
--   1. Aceite dos Termos e da Política, com versão e data.
--   2. Limites de uso por pessoa e por escritório (o custo da IA tem teto).
--   3. Registro de erros do servidor, sem conteúdo de cliente.
--   4. Relato de citação errada, que vai para a fila do curador.
--   5. Base normativa: nota de curadoria nas linhas ingeridas e semente aposentada
--      quando o texto oficial chega.
--
-- Rode como dono das tabelas com BYPASSRLS, como as migrações anteriores.

begin;

-- ───────────────────────── 1. Aceite dos Termos ─────────────────────────
create table aceites_termos (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  versao     text not null check (length(versao) between 4 and 40),
  aceito_em  timestamptz not null default now(),
  unique (usuario_id, versao)
);
alter table aceites_termos enable row level security;
alter table aceites_termos force row level security;  -- sem política: só por funções

-- Registra o aceite da pessoa da sessão (nunca de outra).
create or replace function app.registrar_aceite(p_versao text) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if app.usuario_atual() is null then raise exception 'sem_usuario' using errcode = 'P0001'; end if;
  insert into aceites_termos (usuario_id, versao) values (app.usuario_atual(), p_versao)
  on conflict (usuario_id, versao) do nothing;
end $$;

create or replace function app.aceitou(p_versao text) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from aceites_termos where usuario_id = app.usuario_atual() and versao = p_versao)
$$;

-- ───────────────────────── 2. Limites de uso ─────────────────────────
-- Os padrões vêm do servidor (variáveis LIMITE_*). Esta tabela guarda só as exceções
-- que a equipe da plataforma concede a um escritório (programa fundador, piloto).
create table limites_uso (
  escritorio_id            uuid primary key references escritorios(id) on delete cascade,
  consultas_dia_pessoa     integer check (consultas_dia_pessoa >= 0),
  consultas_mes_pessoa     integer check (consultas_mes_pessoa >= 0),
  consultas_mes_escritorio integer check (consultas_mes_escritorio >= 0),
  nota                     text check (nota is null or length(nota) <= 300),
  atualizado_por           uuid references usuarios(id) on delete set null,
  atualizado_em            timestamptz not null default now()
);
alter table limites_uso enable row level security;
alter table limites_uso force row level security;

-- Dia e mês no fuso de Brasília: a cota vira à meia-noite de São Paulo, não de Londres.
create or replace function app.inicio_do(p_unidade text) returns timestamptz
language sql stable set search_path = public, app as $$
  select date_trunc(p_unidade, now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
$$;

-- Confere a cota da pessoa e do escritório da sessão antes de uma pesquisa.
-- Consultas com status 'erro' não contam: a falha foi nossa, não dela.
create or replace function app.cota_pesquisa(p_dia_pessoa integer, p_mes_pessoa integer, p_mes_escritorio integer, p_por_minuto integer)
returns table (permitido boolean, motivo text, usadas_dia integer, limite_dia integer, usadas_mes integer, limite_mes integer)
language plpgsql stable security definer set search_path = public, app as $$
declare
  u uuid := app.usuario_atual();
  e uuid := app.escritorio_atual();
  l limites_uso;
  ld integer; lm integer; le integer;
  dia integer; mes integer; esc integer; minuto integer;
begin
  if u is null or e is null or not app.membro_do_escritorio_atual() then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;
  select * into l from limites_uso where escritorio_id = e;
  ld := coalesce(l.consultas_dia_pessoa, p_dia_pessoa);
  lm := coalesce(l.consultas_mes_pessoa, p_mes_pessoa);
  le := coalesce(l.consultas_mes_escritorio, p_mes_escritorio);

  select count(*) filter (where c.usuario_id = u and c.criado_em >= app.inicio_do('day')),
         count(*) filter (where c.usuario_id = u),
         count(*),
         count(*) filter (where c.usuario_id = u and c.criado_em > now() - interval '1 minute')
    into dia, mes, esc, minuto
  from consultas c
  where c.escritorio_id = e and c.criado_em >= app.inicio_do('month') and c.status <> 'erro';

  return query select
    (minuto < p_por_minuto and dia < ld and mes < lm and esc < le),
    case when minuto >= p_por_minuto then 'minuto'
         when dia >= ld then 'dia'
         when mes >= lm then 'mes'
         when esc >= le then 'escritorio'
         else null end,
    dia, ld, mes, lm;
end $$;

create or replace function app.plat_definir_limite(p_escritorio uuid, p_dia integer, p_mes integer, p_mes_escritorio integer, p_nota text)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array['suporte']);
  if p_dia is null and p_mes is null and p_mes_escritorio is null then
    delete from limites_uso where escritorio_id = p_escritorio;
    return;
  end if;
  insert into limites_uso (escritorio_id, consultas_dia_pessoa, consultas_mes_pessoa, consultas_mes_escritorio, nota, atualizado_por)
  values (p_escritorio, p_dia, p_mes, p_mes_escritorio, nullif(trim(p_nota), ''), app.usuario_atual())
  on conflict (escritorio_id) do update set
    consultas_dia_pessoa = excluded.consultas_dia_pessoa, consultas_mes_pessoa = excluded.consultas_mes_pessoa,
    consultas_mes_escritorio = excluded.consultas_mes_escritorio, nota = excluded.nota,
    atualizado_por = excluded.atualizado_por, atualizado_em = now();
end $$;

create or replace function app.plat_limites()
returns table (escritorio_id uuid, escritorio text, consultas_dia_pessoa integer, consultas_mes_pessoa integer,
               consultas_mes_escritorio integer, nota text, consultas_mes integer, atualizado_em timestamptz)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array['suporte']);
  return query
  select l.escritorio_id, e.nome, l.consultas_dia_pessoa, l.consultas_mes_pessoa, l.consultas_mes_escritorio, l.nota,
         (select count(*) from consultas c where c.escritorio_id = l.escritorio_id and c.criado_em >= app.inicio_do('month'))::int,
         l.atualizado_em
  from limites_uso l join escritorios e on e.id = l.escritorio_id
  order by e.nome;
end $$;

-- ───────────────────────── 3. Registro de erros ─────────────────────────
-- Só o técnico: rota, mensagem e um código. Nunca a pergunta nem documentos do cliente.
create table registro_erros (
  id            bigint generated always as identity primary key,
  criado_em     timestamptz not null default now(),
  origem        text not null check (length(origem) <= 40),
  mensagem      text not null,
  rota          text,
  codigo        text,
  detalhes      jsonb not null default '{}',
  usuario_id    uuid references usuarios(id) on delete set null,
  escritorio_id uuid references escritorios(id) on delete set null
);
create index registro_erros_recentes on registro_erros (criado_em desc);
alter table registro_erros enable row level security;
alter table registro_erros force row level security;

create or replace function app.registrar_erro(p_origem text, p_mensagem text, p_rota text, p_codigo text, p_detalhes jsonb)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  -- Freio: um laço de erro não enche o banco. Acima de 300 por minuto, descarta.
  if (select count(*) from registro_erros where criado_em > now() - interval '1 minute') >= 300 then return; end if;
  insert into registro_erros (origem, mensagem, rota, codigo, detalhes, usuario_id, escritorio_id)
  values (left(coalesce(p_origem, 'servidor'), 40), left(coalesce(p_mensagem, '—'), 1000), left(p_rota, 300), left(p_codigo, 80),
          coalesce(p_detalhes, '{}'),
          (select id from usuarios where id = app.usuario_atual()),
          (select id from escritorios where id = app.escritorio_atual()));
end $$;

create or replace function app.plat_erros(p_dias integer)
returns table (id bigint, criado_em timestamptz, origem text, mensagem text, rota text, codigo text, detalhes jsonb, escritorio text)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array['suporte']);
  return query
  select r.id, r.criado_em, r.origem, r.mensagem, r.rota, r.codigo, r.detalhes, e.nome
  from registro_erros r left join escritorios e on e.id = r.escritorio_id
  where r.criado_em > now() - make_interval(days => greatest(1, least(p_dias, 90)))
  order by r.criado_em desc limit 300;
end $$;

-- ───────────────────────── 4. Relato de citação errada ─────────────────────────
create table relatos_citacao (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references escritorios(id) on delete cascade,
  usuario_id     uuid references usuarios(id) on delete set null,
  consulta_id    uuid references consultas(id) on delete set null,
  dispositivo_id uuid not null references dispositivos(id) on delete cascade,
  trecho         text check (trecho is null or length(trecho) <= 2000),
  motivo         text not null check (motivo in ('texto_diferente', 'dispositivo_errado', 'fora_de_vigencia', 'nao_sustenta', 'outro')),
  comentario     text check (comentario is null or length(comentario) <= 1000),
  status         text not null default 'aberto' check (status in ('aberto', 'procedente', 'improcedente')),
  nota_curador   text check (nota_curador is null or length(nota_curador) <= 500),
  decidido_por   uuid references usuarios(id) on delete set null,
  decidido_em    timestamptz,
  criado_em      timestamptz not null default now()
);
create index relatos_abertos on relatos_citacao (status, criado_em);
alter table relatos_citacao enable row level security;
alter table relatos_citacao force row level security;
-- O escritório vê os próprios relatos; quem grava é a função abaixo.
create policy relatos_do_escritorio on relatos_citacao for select
  using (escritorio_id = app.escritorio_atual() and app.membro_do_escritorio_atual());

create or replace function app.relatar_citacao(p_consulta uuid, p_dispositivo uuid, p_trecho text, p_motivo text, p_comentario text)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare r uuid;
begin
  if not app.membro_do_escritorio_atual() then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if p_consulta is not null and not exists (
    select 1 from consultas where id = p_consulta and escritorio_id = app.escritorio_atual()
  ) then raise exception 'consulta_invalida' using errcode = 'P0001'; end if;
  if not exists (select 1 from dispositivos where id = p_dispositivo) then
    raise exception 'dispositivo_invalido' using errcode = 'P0001';
  end if;
  if (select count(*) from relatos_citacao where usuario_id = app.usuario_atual() and criado_em > now() - interval '1 day') >= 30 then
    raise exception 'muitos_relatos' using errcode = 'P0001';
  end if;
  insert into relatos_citacao (escritorio_id, usuario_id, consulta_id, dispositivo_id, trecho, motivo, comentario)
  values (app.escritorio_atual(), app.usuario_atual(), p_consulta, p_dispositivo, left(p_trecho, 2000), p_motivo,
          nullif(left(trim(p_comentario), 1000), ''))
  returning id into r;
  insert into auditoria (escritorio_id, usuario_id, acao, alvo_id, detalhes)
  values (app.escritorio_atual(), app.usuario_atual(), 'relato_citacao', p_consulta,
          jsonb_build_object('relato', r, 'dispositivo', p_dispositivo, 'motivo', p_motivo));
  return r;
end $$;

-- Fila do curador. Mostra o dispositivo, o trecho citado e o motivo; nunca a pergunta.
create or replace function app.plat_relatos()
returns table (id uuid, criado_em timestamptz, motivo text, comentario text, trecho text, status text,
               dispositivo_id uuid, norma text, url_oficial text, rotulo text, texto text, status_curadoria text,
               vigencia_inicio date, vigencia_fim date, repeticoes integer)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array['curador']);
  return query
  select r.id, r.criado_em, r.motivo, r.comentario, r.trecho, r.status,
         d.id, n.tipo || ' ' || n.numero || '/' || n.ano, n.url_oficial, d.rotulo, d.texto, d.status_curadoria,
         d.vigencia_inicio, d.vigencia_fim,
         (select count(*) from relatos_citacao o where o.dispositivo_id = r.dispositivo_id and o.status = 'aberto')::int
  from relatos_citacao r
  join dispositivos d on d.id = r.dispositivo_id
  join normas n on n.id = d.norma_id
  where r.status = 'aberto' or r.decidido_em > now() - interval '7 days'
  order by (r.status = 'aberto') desc, r.criado_em;
end $$;

-- Procedente pode devolver o dispositivo à revisão: sai da pesquisa em produção até o curador republicar.
create or replace function app.plat_relato_decidir(p_id uuid, p_status text, p_nota text, p_tirar_da_pesquisa boolean)
returns void language plpgsql security definer set search_path = public, app as $$
declare d uuid; antes text;
begin
  perform app.exigir_plataforma(array['curador']);
  if p_status not in ('procedente', 'improcedente') then raise exception 'status_invalido' using errcode = 'P0001'; end if;
  update relatos_citacao set status = p_status, nota_curador = nullif(left(trim(p_nota), 500), ''),
                             decidido_por = app.usuario_atual(), decidido_em = now()
  where id = p_id returning dispositivo_id into d;
  if d is null then raise exception 'relato_invalido' using errcode = 'P0001'; end if;
  if p_status = 'procedente' and p_tirar_da_pesquisa then
    select status_curadoria into antes from dispositivos where id = d for update;
    update dispositivos set status_curadoria = 'em_revisao',
                            nota_curadoria = coalesce(nullif(left(trim(p_nota), 500), ''), 'Relato de citação procedente.')
    where id = d;
    insert into curadoria_eventos (dispositivo_id, usuario_id, de, para, nota)
    values (d, app.usuario_atual(), antes, 'em_revisao', 'Relato procedente: ' || coalesce(nullif(trim(p_nota), ''), 'sem nota'));
    -- Os outros relatos abertos sobre o mesmo dispositivo ficam resolvidos junto.
    update relatos_citacao set status = 'procedente', nota_curador = 'Resolvido com o relato ' || p_id,
                               decidido_por = app.usuario_atual(), decidido_em = now()
    where dispositivo_id = d and status = 'aberto';
  end if;
end $$;

-- ───────────────────────── 5. Base normativa ─────────────────────────
-- Uma linha da semente sai da pesquisa quando o texto oficial do mesmo artigo entra.
-- Rejeitado não volta na busca (pesquisar_dispositivos só lê rascunho, em_revisao e publicado).
create or replace function app.aposentar_semente(p_norma uuid) returns integer
language plpgsql security definer set search_path = public, app as $$
declare n integer;
begin
  with alvo as (
    select s.id, s.status_curadoria from dispositivos s
    where s.norma_id = p_norma and s.origem = 'semente' and s.status_curadoria <> 'rejeitado'
      and exists (
        select 1 from dispositivos o
        where o.norma_id = s.norma_id and o.origem = 'ingestao'
          -- "ADCT, art. 125, § 1º" é coberto pelo artigo inteiro "ADCT, art. 125"
          and (o.rotulo = s.rotulo or s.rotulo like o.rotulo || ',%')
      )
  ), feito as (
    update dispositivos d set status_curadoria = 'rejeitado',
                              nota_curadoria = 'Substituído pelo texto oficial do Planalto.'
    from alvo where d.id = alvo.id
    returning d.id, alvo.status_curadoria as antes
  )
  insert into curadoria_eventos (dispositivo_id, de, para, nota)
  select id, antes, 'rejeitado', 'Semente aposentada: texto oficial ingerido.' from feito;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function app.aposentar_semente(uuid) from public;

-- Busca: mesmo critério da 002, com desempate fixo. Empate de relevância voltava em ordem
-- arbitrária, e a mesma pergunta podia trazer outra fonte em primeiro lugar.
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
  order by 13 desc, d.vigencia_inicio desc, d.rotulo
  limit greatest(1, least(p_limite, 20))
$$;

-- ───────────────────────── Expurgo: prazos novos ─────────────────────────
create or replace function app.expurgar_registros() returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare erros integer;
begin
  delete from registro_erros where criado_em < now() - interval '90 days';
  get diagnostics erros = row_count;
  update relatos_citacao set comentario = null
  where comentario is not null and decidido_em < now() - interval '180 days';
  return jsonb_build_object('erros_apagados', erros);
end $$;
revoke execute on function app.expurgar_registros() from public;

-- ───────────────────────── Registro de tratamento (LGPD, art. 37) ─────────────────────────
insert into registro_tratamento (operacao, finalidade, base_legal, dados, retencao) values
  ('Aceite dos Termos e da Política', 'Provar a versão aceita por cada pessoa',
   'Execução de contrato (art. 7º, V) e exercício regular de direitos (art. 7º, VI)', 'Usuário, versão, data e hora', 'Enquanto existir a conta e pelo prazo prescricional'),
  ('Limites de uso', 'Controlar o custo de IA e evitar abuso', 'Execução de contrato (art. 7º, V)',
   'Contagem de consultas por pessoa e escritório (sem conteúdo)', 'Mês corrente'),
  ('Registro de erros', 'Corrigir falhas e manter o serviço seguro', 'Legítimo interesse (art. 7º, IX) e segurança (art. 46)',
   'Rota, mensagem técnica, horário, usuário e escritório; nunca o conteúdo das consultas', '90 dias'),
  ('Relatos de citação', 'Corrigir a base normativa quando um advogado aponta erro',
   'Legítimo interesse (art. 7º, IX)', 'Dispositivo, trecho citado, motivo e comentário de quem relatou', 'Comentário apagado 180 dias após a decisão'),
  ('Redação por IA (Anthropic)', 'Redigir a resposta a partir dos dispositivos recuperados',
   'Execução de contrato (art. 7º, V); transferência internacional pelo art. 33, II e IX', 'Pergunta e trechos normativos; sem documentos privados nesta fase', 'Sem retenção para treino, conforme os termos comerciais da API');

-- ───────────────────────── Permissões do papel da aplicação ─────────────────────────
grant execute on function app.registrar_aceite(text), app.aceitou(text),
  app.cota_pesquisa(integer, integer, integer, integer), app.inicio_do(text),
  app.plat_definir_limite(uuid, integer, integer, integer, text), app.plat_limites(),
  app.registrar_erro(text, text, text, text, jsonb), app.plat_erros(integer),
  app.relatar_citacao(uuid, uuid, text, text, text), app.plat_relatos(), app.plat_relato_decidir(uuid, text, text, boolean)
  to app_user;
grant select on relatos_citacao to app_user;

commit;
