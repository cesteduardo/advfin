-- Semente provisória da base normativa (desenvolvimento e beta fechado).
--
-- ATENÇÃO: estes textos foram transcritos sem conferência com o Diário Oficial.
-- Entram como origem = 'semente' e status_curadoria = 'em_revisao': a pesquisa só
-- os mostra fora de produção (ou com BASE_INCLUIR_NAO_REVISADOS=1), sempre com a
-- faixa "não conferido". O curador deve substituí-los pelo texto do Planalto
-- (scripts/ingerir-planalto.mjs) antes de qualquer uso em peça.
--
-- Rodar como dono das tabelas:  psql "$ADMIN_URL" -f db/seeds/semente_reforma.sql

begin;

insert into normas (tipo, numero, ano, ementa, url_oficial, publicada_em) values
  ('EC', '132', 2023, 'Altera o Sistema Tributário Nacional (Reforma Tributária do consumo).',
   'https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm', '2023-12-21'),
  ('LC', '214', 2025, 'Institui o IBS, a CBS e o Imposto Seletivo.',
   'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm', '2025-01-16')
on conflict do nothing;

with ec as (select id from normas where tipo = 'EC' and numero = '132' and ano = 2023),
     lc as (select id from normas where tipo = 'LC' and numero = '214' and ano = 2025),
     novos (norma, rotulo, texto, inicio) as (values
  ('ec', 'ADCT, art. 125, caput',
   'Em 2026, o imposto previsto no art. 156-A será cobrado à alíquota estadual de 0,1% (um décimo por cento), e a contribuição prevista no art. 195, V, será cobrada à alíquota de 0,9% (nove décimos por cento).',
   date '2023-12-21'),
  ('ec', 'ADCT, art. 125, § 1º',
   'O montante recolhido na forma do caput será compensado com o valor devido das contribuições previstas no art. 195, I, "b", e IV, e da contribuição para o Programa de Integração Social a que se refere o art. 239.',
   date '2023-12-21'),
  ('ec', 'ADCT, art. 126',
   'A partir de 2027: I - serão cobrados: a) a contribuição prevista no art. 195, V; b) o imposto previsto no art. 153, VIII; II - serão extintas as contribuições previstas no art. 195, I, "b", e IV, e a contribuição para o Programa de Integração Social de que trata o art. 239, desde que instituída a contribuição referida no art. 195, V.',
   date '2023-12-21'),
  ('ec', 'ADCT, art. 127',
   'Em 2027 e 2028, o imposto previsto no art. 156-A será cobrado à alíquota estadual de 0,05% (cinco centésimos por cento) e à alíquota municipal de 0,05% (cinco centésimos por cento). Parágrafo único. Em 2027 e 2028, a alíquota da contribuição prevista no art. 195, V, será reduzida em 0,1 (um décimo) ponto percentual.',
   date '2023-12-21'),
  ('ec', 'ADCT, art. 128',
   'De 2029 a 2032, as alíquotas dos impostos previstos nos arts. 155, II, e 156, III, serão fixadas nas seguintes proporções das alíquotas fixadas nas respectivas legislações: I - 9/10 (nove décimos), em 2029; II - 8/10 (oito décimos), em 2030; III - 7/10 (sete décimos), em 2031; IV - 6/10 (seis décimos), em 2032.',
   date '2023-12-21'),
  ('ec', 'ADCT, art. 129',
   'Ficam extintos, a partir de 2033, os impostos previstos nos arts. 155, II, e 156, III, da Constituição Federal.',
   date '2023-12-21'),
  ('ec', 'art. 9º, caput',
   'A lei complementar que instituir o imposto de que trata o art. 156-A e a contribuição de que trata o art. 195, V, ambos da Constituição Federal, poderá prever os regimes diferenciados de tributação de que trata este artigo, desde que sejam uniformes em todo o território nacional e sejam realizados os respectivos ajustes nas alíquotas de referência com vistas a reequilibrar a arrecadação da esfera federativa.',
   date '2023-12-21'),
  ('ec', 'art. 9º, § 1º',
   'A lei complementar definirá as operações beneficiadas com redução de 60% (sessenta por cento) das alíquotas dos tributos de que trata o caput entre as relativas aos seguintes bens e serviços: I - serviços de educação; II - serviços de saúde; III - dispositivos médicos; IV - dispositivos de acessibilidade próprios para pessoas com deficiência; V - medicamentos; VI - produtos de cuidados básicos à saúde menstrual; VII - serviços de transporte público coletivo de passageiros rodoviário e metroviário de caráter urbano, semiurbano e metropolitano; VIII - alimentos destinados ao consumo humano; IX - produtos de higiene pessoal e limpeza majoritariamente consumidos por famílias de baixa renda; X - produtos agropecuários, aquícolas, pesqueiros, florestais e extrativistas vegetais in natura; XI - insumos agropecuários e aquícolas; XII - produções artísticas, culturais, de eventos, jornalísticas e audiovisuais nacionais, atividades desportivas e comunicação institucional; XIII - bens e serviços relacionados a soberania e segurança nacional, segurança da informação e segurança cibernética.',
   date '2023-12-21'),
  ('lc', 'art. 1º',
   'Ficam instituídos: I - o Imposto sobre Bens e Serviços (IBS), de competência compartilhada entre Estados, Municípios e Distrito Federal, de que trata o art. 156-A da Constituição Federal; II - a Contribuição Social sobre Bens e Serviços (CBS), de competência da União, de que trata o inciso V do caput do art. 195 da Constituição Federal; e III - o Imposto Seletivo (IS), de competência da União, de que trata o inciso VIII do caput do art. 153 da Constituição Federal.',
   date '2025-01-16')
)
insert into dispositivos (norma_id, rotulo, texto, vigencia_inicio, status_curadoria, origem)
select case n.norma when 'ec' then (select id from ec) else (select id from lc) end, n.rotulo, n.texto, n.inicio, 'em_revisao', 'semente'
from novos n
where not exists (
  select 1 from dispositivos d
  where d.rotulo = n.rotulo
    and d.norma_id = case n.norma when 'ec' then (select id from ec) else (select id from lc) end
);

commit;
