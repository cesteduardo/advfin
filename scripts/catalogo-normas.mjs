/**
 * Catálogo do vade-mécum tributário: o que entra na base, de onde vem e em que grupo.
 *
 * Campos:
 *   tipo, numero, ano, publicada   identificação e data usada como início provisório da vigência
 *   apelido                        nome curto que o advogado lê ("CTN", "RIR/2018")
 *   esfera, ente                   federal/BR, estadual/SP, municipal/SP-capital
 *   url                            página oficial com o texto compilado (baixada pelo carregador)
 *   portal                         onde achar a página quando não há URL estável; o carregador
 *                                  então exige o arquivo salvo em --pasta
 *   arquivo                        nome do arquivo em --pasta (páginas salvas pelo navegador)
 *   recorte                        { ate: marco onde a leitura para, artigos: [de, até] }
 *   modo: "documento"              soluções de consulta e pareceres: guarda só a ementa
 *
 * As URLs do Planalto seguem o padrão do site (ccivil_03). Se alguma mudar, o carregador
 * avisa a norma que falhou e segue com as outras; corrija aqui ou use --pasta.
 * As datas são as das normas; o curador confere a vigência de cada dispositivo na fila.
 */

const P = "https://www.planalto.gov.br/ccivil_03";
const RECEITA = "https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action";
const SEFAZ_SP = "https://legislacao.fazenda.sp.gov.br/";
const PREFEITURA_SP = "https://legislacao.prefeitura.sp.gov.br/";

export const CATALOGO = [
  // ── Reforma Tributária ──
  {
    grupo: "reforma", arquivo: "emc132.htm",
    tipo: "EC", numero: "132", ano: "2023", publicada: "2023-12-21",
    ementa: "Altera o Sistema Tributário Nacional (Reforma Tributária do consumo).",
    url: `${P}/constituicao/emendas/emc/emc132.htm`,
  },
  {
    grupo: "reforma", arquivo: "lcp214.htm",
    tipo: "LC", numero: "214", ano: "2025", publicada: "2025-01-16",
    ementa: "Institui o Imposto sobre Bens e Serviços (IBS), a Contribuição Social sobre Bens e Serviços (CBS) e o Imposto Seletivo (IS).",
    url: `${P}/leis/lcp/lcp214.htm`,
  },

  // ── Constituição e normas gerais ──
  {
    grupo: "federal", arquivo: "constituicao.htm",
    tipo: "CF", numero: "1988", ano: "1988", publicada: "1988-10-05", apelido: "CF/1988",
    ementa: "Constituição da República Federativa do Brasil: Sistema Tributário Nacional (arts. 145 a 162).",
    url: `${P}/constituicao/constituicao.htm`,
    recorte: { ate: "ATO DAS DISPOSI[CÇ][OÕ]ES CONSTITUCIONAIS TRANSIT[OÓ]RIAS", artigos: [145, 162] },
  },
  {
    grupo: "federal", arquivo: "l5172compilado.htm",
    tipo: "LEI", numero: "5172", ano: "1966", publicada: "1966-10-25", apelido: "CTN",
    ementa: "Código Tributário Nacional: dispõe sobre o Sistema Tributário Nacional e institui normas gerais de direito tributário.",
    url: `${P}/leis/l5172compilado.htm`,
  },
  {
    grupo: "federal", arquivo: "d70235cons.htm",
    tipo: "DECRETO", numero: "70235", ano: "1972", publicada: "1972-03-06", apelido: "Decreto 70.235/1972 (PAF)",
    ementa: "Dispõe sobre o processo administrativo fiscal.",
    url: `${P}/decreto/d70235cons.htm`,
  },
  {
    grupo: "federal", arquivo: "l6830.htm",
    tipo: "LEI", numero: "6830", ano: "1980", publicada: "1980-09-22", apelido: "Lei 6.830/1980 (LEF)",
    ementa: "Dispõe sobre a cobrança judicial da Dívida Ativa da Fazenda Pública.",
    url: `${P}/leis/l6830.htm`,
  },

  // ── PIS/Cofins ──
  {
    grupo: "federal", arquivo: "l9718compilada.htm",
    tipo: "LEI", numero: "9718", ano: "1998", publicada: "1998-11-27", apelido: "Lei 9.718/1998",
    ementa: "Altera a legislação tributária federal (PIS/Pasep e Cofins no regime cumulativo).",
    url: `${P}/leis/l9718compilada.htm`,
  },
  {
    grupo: "federal", arquivo: "l10637.htm",
    tipo: "LEI", numero: "10637", ano: "2002", publicada: "2002-12-30", apelido: "Lei 10.637/2002",
    ementa: "Dispõe sobre a não cumulatividade na cobrança da contribuição para o PIS/Pasep.",
    url: `${P}/leis/2002/l10637.htm`,
  },
  {
    grupo: "federal", arquivo: "l10.833.htm",
    tipo: "LEI", numero: "10833", ano: "2003", publicada: "2003-12-29", apelido: "Lei 10.833/2003",
    ementa: "Altera a legislação tributária federal (Cofins não cumulativa).",
    url: `${P}/leis/2003/l10.833.htm`,
  },
  {
    grupo: "federal", arquivo: "l10.865.htm",
    tipo: "LEI", numero: "10865", ano: "2004", publicada: "2004-04-30", apelido: "Lei 10.865/2004",
    ementa: "Dispõe sobre o PIS/Pasep-Importação e a Cofins-Importação.",
    url: `${P}/_ato2004-2006/2004/lei/l10.865.htm`,
  },

  // ── IPI ──
  {
    grupo: "federal", arquivo: "l4502.htm",
    tipo: "LEI", numero: "4502", ano: "1964", publicada: "1964-11-30", apelido: "Lei 4.502/1964 (IPI)",
    ementa: "Dispõe sobre o Imposto de Consumo, hoje Imposto sobre Produtos Industrializados.",
    url: `${P}/leis/l4502.htm`,
  },
  {
    grupo: "federal", arquivo: "d7212.htm",
    tipo: "DECRETO", numero: "7212", ano: "2010", publicada: "2010-06-15", apelido: "RIPI/2010",
    ementa: "Regulamento do Imposto sobre Produtos Industrializados.",
    url: `${P}/_ato2007-2010/2010/decreto/d7212.htm`,
  },

  // ── IRPJ/CSLL ──
  {
    grupo: "federal", arquivo: "l7689.htm",
    tipo: "LEI", numero: "7689", ano: "1988", publicada: "1988-12-15", apelido: "Lei 7.689/1988 (CSLL)",
    ementa: "Institui contribuição social sobre o lucro das pessoas jurídicas.",
    url: `${P}/leis/l7689.htm`,
  },
  {
    grupo: "federal", arquivo: "l9249.htm",
    tipo: "LEI", numero: "9249", ano: "1995", publicada: "1995-12-26", apelido: "Lei 9.249/1995",
    ementa: "Altera a legislação do imposto de renda das pessoas jurídicas e da CSLL.",
    url: `${P}/leis/l9249.htm`,
  },
  {
    grupo: "federal", arquivo: "l9430.htm",
    tipo: "LEI", numero: "9430", ano: "1996", publicada: "1996-12-27", apelido: "Lei 9.430/1996",
    ementa: "Dispõe sobre a legislação tributária federal, as contribuições para a seguridade social e o processo administrativo de consulta.",
    url: `${P}/leis/l9430.htm`,
  },
  {
    grupo: "federal", arquivo: "d9580.htm",
    tipo: "DECRETO", numero: "9580", ano: "2018", publicada: "2018-11-22", apelido: "RIR/2018",
    ementa: "Regulamento do Imposto sobre a Renda e Proventos de Qualquer Natureza.",
    url: `${P}/_ato2015-2018/2018/decreto/d9580.htm`,
  },

  // ── Simples Nacional, ICMS e ISS (normas gerais) ──
  {
    grupo: "federal", arquivo: "lcp123.htm",
    tipo: "LC", numero: "123", ano: "2006", publicada: "2006-12-14",
    ementa: "Estatuto Nacional da Microempresa e da Empresa de Pequeno Porte (Simples Nacional).",
    url: `${P}/leis/lcp/lcp123.htm`,
  },
  {
    grupo: "federal", arquivo: "lcp87.htm",
    tipo: "LC", numero: "87", ano: "1996", publicada: "1996-09-13", apelido: "LC 87/1996 (Lei Kandir)",
    ementa: "Dispõe sobre o ICMS (normas gerais).",
    url: `${P}/leis/lcp/lcp87.htm`,
  },
  {
    grupo: "federal", arquivo: "lcp116.htm",
    tipo: "LC", numero: "116", ano: "2003", publicada: "2003-07-31",
    ementa: "Dispõe sobre o ISS de competência dos Municípios e do Distrito Federal (normas gerais).",
    url: `${P}/leis/lcp/lcp116.htm`,
  },

  // ── Receita Federal: instruções normativas (Sijut, sem URL estável por ato) ──
  {
    grupo: "receita", arquivo: "in-rfb-2121-2022.html",
    tipo: "INSTRUCAO_NORMATIVA", numero: "2121", ano: "2022", publicada: "2022-12-15", apelido: "IN RFB 2.121/2022",
    ementa: "Consolida as normas sobre a apuração, a cobrança, a fiscalização, a arrecadação e a administração da Contribuição para o PIS/Pasep e da Cofins.",
    portal: RECEITA,
  },
  {
    grupo: "receita", arquivo: "in-rfb-1700-2017.html",
    tipo: "INSTRUCAO_NORMATIVA", numero: "1700", ano: "2017", publicada: "2017-03-14", apelido: "IN RFB 1.700/2017",
    ementa: "Dispõe sobre a determinação e o pagamento do IRPJ e da CSLL.",
    portal: RECEITA,
  },
  {
    grupo: "receita", arquivo: "in-rfb-2055-2021.html",
    tipo: "INSTRUCAO_NORMATIVA", numero: "2055", ano: "2021", publicada: "2021-12-06", apelido: "IN RFB 2.055/2021",
    ementa: "Dispõe sobre restituição, compensação, ressarcimento e reembolso.",
    portal: RECEITA,
  },

  // ── São Paulo: ICMS (estado) e ISS (capital). Portais oficiais sem URL estável por ato ──
  {
    grupo: "sp", arquivo: "sp-lei-6374-1989.html",
    tipo: "LEI_ESTADUAL", numero: "6374", ano: "1989", publicada: "1989-03-01", esfera: "estadual", ente: "SP", apelido: "Lei SP 6.374/1989 (ICMS)",
    ementa: "Dispõe sobre a instituição do ICMS no Estado de São Paulo.",
    portal: SEFAZ_SP,
  },
  {
    grupo: "sp", arquivo: "sp-ricms-45490-2000.html",
    tipo: "DECRETO_ESTADUAL", numero: "45490", ano: "2000", publicada: "2000-11-30", esfera: "estadual", ente: "SP", apelido: "RICMS/SP 2000",
    ementa: "Regulamento do ICMS do Estado de São Paulo.",
    portal: SEFAZ_SP,
  },
  {
    grupo: "sp", arquivo: "spcapital-lei-13701-2003.html",
    tipo: "LEI_MUNICIPAL", numero: "13701", ano: "2003", publicada: "2003-12-24", esfera: "municipal", ente: "SP-capital", apelido: "Lei SP-capital 13.701/2003 (ISS)",
    ementa: "Altera a legislação do Imposto sobre Serviços de Qualquer Natureza no Município de São Paulo.",
    portal: PREFEITURA_SP,
  },
  {
    grupo: "sp", arquivo: "spcapital-riss-53151-2012.html",
    tipo: "DECRETO_MUNICIPAL", numero: "53151", ano: "2012", publicada: "2012-05-17", esfera: "municipal", ente: "SP-capital", apelido: "RISS/SP-capital 2012",
    ementa: "Regulamento do ISS do Município de São Paulo (conferir número e data no portal).",
    portal: PREFEITURA_SP,
  },
];

export const GRUPOS = {
  reforma: "EC 132/2023 e LC 214/2025",
  federal: "CF (arts. 145 a 162), CTN, PAF, LEF, PIS/Cofins, IPI, IRPJ/CSLL, RIR, RIPI, LC 123, LC 87, LC 116",
  receita: "instruções normativas da Receita (páginas salvas do Sijut)",
  sp: "ICMS do Estado de São Paulo e ISS da capital (páginas salvas dos portais)",
  solucoes: "soluções de consulta da Receita (pasta com uma página salva por solução)",
};
