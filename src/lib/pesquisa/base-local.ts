/**
 * Base normativa embutida, para o laboratório estático (GitHub Pages), onde não há banco.
 *
 * São os mesmos textos de db/seeds/semente_reforma.sql (um teste garante que não divergem),
 * todos transcritos sem conferência com o Diário Oficial: entram como "em_revisao".
 * A recuperação imita, de forma simples, a busca do Postgres: termos normalizados,
 * radical curto e filtro de vigência na data escolhida.
 */
import type { Trecho } from "./tipos";
import { SINONIMOS, palavrasDoTrecho, radical, selecionarFontes, termosDaPergunta } from "./termos";

type Semente = Omit<Trecho, "ref" | "curadoria" | "origem">;

const EC132 = {
  norma: "EC 132/2023",
  ementa: "Altera o Sistema Tributário Nacional (Reforma Tributária do consumo).",
  url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm",
  vigenciaInicio: "2023-12-21",
  vigenciaFim: null,
};
const LC214 = {
  norma: "LC 214/2025",
  ementa: "Institui o IBS, a CBS e o Imposto Seletivo.",
  url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm",
  vigenciaInicio: "2025-01-16",
  vigenciaFim: null,
};

export const BASE_LOCAL: Semente[] = [
  {
    ...EC132,
    id: "ec132-adct-125",
    rotulo: "ADCT, art. 125, caput",
    texto:
      "Em 2026, o imposto previsto no art. 156-A será cobrado à alíquota estadual de 0,1% (um décimo por cento), e a contribuição prevista no art. 195, V, será cobrada à alíquota de 0,9% (nove décimos por cento).",
  },
  {
    ...EC132,
    id: "ec132-adct-125-p1",
    rotulo: "ADCT, art. 125, § 1º",
    texto:
      'O montante recolhido na forma do caput será compensado com o valor devido das contribuições previstas no art. 195, I, "b", e IV, e da contribuição para o Programa de Integração Social a que se refere o art. 239.',
  },
  {
    ...EC132,
    id: "ec132-adct-126",
    rotulo: "ADCT, art. 126",
    texto:
      'A partir de 2027: I - serão cobrados: a) a contribuição prevista no art. 195, V; b) o imposto previsto no art. 153, VIII; II - serão extintas as contribuições previstas no art. 195, I, "b", e IV, e a contribuição para o Programa de Integração Social de que trata o art. 239, desde que instituída a contribuição referida no art. 195, V.',
  },
  {
    ...EC132,
    id: "ec132-adct-127",
    rotulo: "ADCT, art. 127",
    texto:
      "Em 2027 e 2028, o imposto previsto no art. 156-A será cobrado à alíquota estadual de 0,05% (cinco centésimos por cento) e à alíquota municipal de 0,05% (cinco centésimos por cento). Parágrafo único. Em 2027 e 2028, a alíquota da contribuição prevista no art. 195, V, será reduzida em 0,1 (um décimo) ponto percentual.",
  },
  {
    ...EC132,
    id: "ec132-adct-128",
    rotulo: "ADCT, art. 128",
    texto:
      "De 2029 a 2032, as alíquotas dos impostos previstos nos arts. 155, II, e 156, III, serão fixadas nas seguintes proporções das alíquotas fixadas nas respectivas legislações: I - 9/10 (nove décimos), em 2029; II - 8/10 (oito décimos), em 2030; III - 7/10 (sete décimos), em 2031; IV - 6/10 (seis décimos), em 2032.",
  },
  {
    ...EC132,
    id: "ec132-adct-129",
    rotulo: "ADCT, art. 129",
    texto: "Ficam extintos, a partir de 2033, os impostos previstos nos arts. 155, II, e 156, III, da Constituição Federal.",
  },
  {
    ...EC132,
    id: "ec132-art9",
    rotulo: "art. 9º, caput",
    texto:
      "A lei complementar que instituir o imposto de que trata o art. 156-A e a contribuição de que trata o art. 195, V, ambos da Constituição Federal, poderá prever os regimes diferenciados de tributação de que trata este artigo, desde que sejam uniformes em todo o território nacional e sejam realizados os respectivos ajustes nas alíquotas de referência com vistas a reequilibrar a arrecadação da esfera federativa.",
  },
  {
    ...EC132,
    id: "ec132-art9-p1",
    rotulo: "art. 9º, § 1º",
    texto:
      "A lei complementar definirá as operações beneficiadas com redução de 60% (sessenta por cento) das alíquotas dos tributos de que trata o caput entre as relativas aos seguintes bens e serviços: I - serviços de educação; II - serviços de saúde; III - dispositivos médicos; IV - dispositivos de acessibilidade próprios para pessoas com deficiência; V - medicamentos; VI - produtos de cuidados básicos à saúde menstrual; VII - serviços de transporte público coletivo de passageiros rodoviário e metroviário de caráter urbano, semiurbano e metropolitano; VIII - alimentos destinados ao consumo humano; IX - produtos de higiene pessoal e limpeza majoritariamente consumidos por famílias de baixa renda; X - produtos agropecuários, aquícolas, pesqueiros, florestais e extrativistas vegetais in natura; XI - insumos agropecuários e aquícolas; XII - produções artísticas, culturais, de eventos, jornalísticas e audiovisuais nacionais, atividades desportivas e comunicação institucional; XIII - bens e serviços relacionados a soberania e segurança nacional, segurança da informação e segurança cibernética.",
  },
  {
    ...LC214,
    id: "lc214-art1",
    rotulo: "art. 1º",
    texto:
      "Ficam instituídos: I - o Imposto sobre Bens e Serviços (IBS), de competência compartilhada entre Estados, Municípios e Distrito Federal, de que trata o art. 156-A da Constituição Federal; II - a Contribuição Social sobre Bens e Serviços (CBS), de competência da União, de que trata o inciso V do caput do art. 195 da Constituição Federal; e III - o Imposto Seletivo (IS), de competência da União, de que trata o inciso VIII do caput do art. 153 da Constituição Federal.",
  },
];

/** Os dispositivos vigentes na data com mais termos da pergunta, numerados D1, D2… */
export function recuperarLocal(pergunta: string, data: string, limite = 6): Trecho[] {
  const ts = termosDaPergunta(pergunta).flatMap((t) => [t, ...(SINONIMOS[t] ?? [])]).map(radical);
  if (ts.length === 0) return [];
  const achados = BASE_LOCAL.filter((d) => d.vigenciaInicio <= data && (!d.vigenciaFim || d.vigenciaFim >= data))
    .map((d) => {
      const palavras = palavrasDoTrecho(d);
      return { d, nota: ts.filter((t) => palavras.has(t)).length };
    })
    .filter((x) => x.nota > 0)
    .sort((a, b) => b.nota - a.nota)
    .slice(0, limite)
    .map(({ d }, i): Trecho => ({ ...d, ref: `D${i + 1}`, curadoria: "em_revisao", origem: "semente" }));
  return selecionarFontes(pergunta, achados);
}
