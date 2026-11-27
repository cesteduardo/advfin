-- AdvFin: base normativa ampliada (vade-mécum tributário).
--
-- A base deixa de ser só a Reforma: Constituição (Sistema Tributário Nacional), CTN,
-- leis e regulamentos federais, atos da Receita e, depois, ICMS e ISS de São Paulo.
--   - normas ganham esfera (federal, estadual, municipal), ente ("BR", "SP", "SP-capital")
--     e um nome curto para a tela ("CTN", "RIR/2018");
--   - novos tipos de norma: CF, DECRETO_LEI, LEI_ESTADUAL, DECRETO_ESTADUAL, LEI_MUNICIPAL,
--     DECRETO_MUNICIPAL, PARECER_NORMATIVO, ATO_DECLARATORIO;
--   - a mesma numeração pode existir em entes diferentes (Lei 6.374 de SP e uma lei federal 6.374).
-- Rode como dono das tabelas, depois da 004.

begin;

alter table normas add column esfera text not null default 'federal' check (esfera in ('federal', 'estadual', 'municipal')),
                   add column ente text not null default 'BR' check (length(ente) between 2 and 40),
                   add column apelido text check (apelido is null or length(apelido) <= 80);

alter table normas drop constraint if exists normas_tipo_check;
alter table normas add constraint normas_tipo_check check (tipo in (
  'CF', 'EC', 'LC', 'LEI', 'DECRETO_LEI', 'DECRETO', 'RESOLUCAO', 'ATO_COMITE_GESTOR',
  'SOLUCAO_CONSULTA', 'INSTRUCAO_NORMATIVA', 'PARECER_NORMATIVO', 'ATO_DECLARATORIO',
  'LEI_ESTADUAL', 'DECRETO_ESTADUAL', 'LEI_MUNICIPAL', 'DECRETO_MUNICIPAL'));

alter table normas drop constraint if exists normas_tipo_numero_ano_key;
alter table normas add constraint normas_unica unique (tipo, numero, ano, ente);

-- Busca: devolve também ente e nome curto, para a tela dizer "CTN, art. 142" e não "LEI 5172/1966".
drop function if exists pesquisar_dispositivos(text, date, integer, boolean);
create or replace function pesquisar_dispositivos(p_termos text, p_data date, p_limite integer, p_incluir_nao_revisados boolean)
returns table (
  id uuid, norma_tipo text, norma_numero text, norma_ano integer, norma_ementa text, url_oficial text,
  norma_ente text, norma_apelido text,
  rotulo text, texto text, vigencia_inicio date, vigencia_fim date, status_curadoria text, origem text, relevancia real
)
language sql stable security definer set search_path = public as $$
  with q as (
    select websearch_to_tsquery('portuguese', p_termos) as estrita,
           -- consulta ampla: qualquer termo serve (OR), para perguntas em linguagem natural
           to_tsquery('portuguese', coalesce(nullif(array_to_string(
             array(select quote_literal(lexeme) from unnest(to_tsvector('portuguese', p_termos))), ' | '), ''), '''_''')) as ampla
  )
  select d.id, n.tipo, n.numero, n.ano, n.ementa, n.url_oficial, n.ente, n.apelido,
         d.rotulo, d.texto, d.vigencia_inicio, d.vigencia_fim, d.status_curadoria, d.origem,
         (ts_rank_cd(d.busca, q.estrita) * 2 + ts_rank_cd(d.busca, q.ampla))::real
  from dispositivos d join normas n on n.id = d.norma_id, q
  where (d.status_curadoria = 'publicado'
         or (p_incluir_nao_revisados and d.status_curadoria in ('rascunho', 'em_revisao')))
    and d.vigencia_inicio <= p_data
    and (d.vigencia_fim is null or d.vigencia_fim > p_data)
    and (d.busca @@ q.estrita or d.busca @@ q.ampla)
  order by 15 desc, d.vigencia_inicio desc, d.rotulo
  limit greatest(1, least(p_limite, 20))
$$;
grant execute on function pesquisar_dispositivos(text, date, integer, boolean) to app_user;

-- Painel do curador: quanto de cada norma já foi conferido.
create or replace function app.plat_cobertura_base()
returns table (norma text, esfera text, ente text, total integer, publicados integer, em_revisao integer, rejeitados integer)
language plpgsql stable security definer set search_path = public, app as $$
begin
  perform app.exigir_plataforma(array['curador', 'suporte']);
  return query
  select coalesce(n.apelido, n.tipo || ' ' || n.numero || '/' || n.ano), n.esfera, n.ente,
         count(d.id)::int,
         count(d.id) filter (where d.status_curadoria = 'publicado')::int,
         count(d.id) filter (where d.status_curadoria in ('rascunho', 'em_revisao'))::int,
         count(d.id) filter (where d.status_curadoria = 'rejeitado')::int
  from normas n left join dispositivos d on d.norma_id = n.id
  group by n.id order by n.esfera, n.ente, n.ano, n.numero;
end $$;
grant execute on function app.plat_cobertura_base() to app_user;

commit;
