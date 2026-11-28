-- AdvFin: notas da equipe nos casos.
--
-- Cada caso ganha notas curtas, em ordem cronológica, para a equipe saber o que cada um fez.
-- Só texto: documentos ficam fora, por sigilo. Quem vê o caso lê e escreve notas; apagar,
-- só o próprio autor ou Administrador para cima (o Supervisionado não apaga nota alheia).
-- Pessoas por caso: sem teto (casos_membros não tem limite, nem aqui nem na aplicação).
-- Rode como dono das tabelas, depois da 005.

begin;

create table casos_notas (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default app.escritorio_atual() references escritorios(id) on delete cascade,
  caso_id       uuid not null references casos(id) on delete cascade,
  autor_id      uuid not null default app.usuario_atual() references usuarios(id),
  texto         text not null check (length(btrim(texto)) between 1 and 4000),
  criado_em     timestamptz not null default now()
);
create index casos_notas_caso on casos_notas (caso_id, criado_em);

alter table casos_notas enable row level security;
alter table casos_notas force row level security;

create policy casos_notas_leitura on casos_notas for select
  using (escritorio_id = app.escritorio_atual() and app.nivel_atual() is not null and app.caso_visivel(caso_id));
create policy casos_notas_criacao on casos_notas for insert
  with check (escritorio_id = app.escritorio_atual() and autor_id = app.usuario_atual()
              and app.pode('usar_ferramentas') and app.caso_visivel(caso_id));
create policy casos_notas_exclusao on casos_notas for delete
  using (escritorio_id = app.escritorio_atual() and app.caso_visivel(caso_id)
         and (autor_id = app.usuario_atual() or app.nivel_atual() >= 'admin'));

grant select, delete on casos_notas to app_user;
grant insert (caso_id, texto) on casos_notas to app_user;

commit;
