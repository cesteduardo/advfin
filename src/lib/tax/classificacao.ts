/**
 * Classificação NCM/NBS → regime de IBS/CBS.
 *
 * Tabela versionada em código, como o cronograma. Cada linha traz o fundamento e
 * `conferido: false` até o curador conferir contra o texto oficial e os anexos da
 * LC 214/2025. A busca é determinística: código por prefixo mais longo, ou termos
 * da descrição. Nenhum modelo escolhe alíquota.
 *
 * Esta tabela é deliberadamente curta: é o esqueleto que a curadoria vai preencher,
 * não uma tabela de referência.
 */
import type { Regime } from "./cronograma";

export interface Classificacao {
  tipo: "NCM" | "NBS";
  /** Prefixo do código, só dígitos. Vazio = código ainda não definido pelo curador. */
  codigo: string;
  descricao: string;
  regime: Regime;
  fundamento: string;
  conferido: boolean;
  observacao?: string;
}

const anexo = (n: string, tema: string) => `LC 214/2025, Anexo ${n} (${tema}); dispositivo e código a conferir`;

export const CLASSIFICACOES: readonly Classificacao[] = [
  { tipo: "NCM", codigo: "100630", descricao: "Arroz semibranqueado ou branqueado", regime: "aliquota_zero", fundamento: anexo("I", "Cesta Básica Nacional"), conferido: false },
  { tipo: "NCM", codigo: "071333", descricao: "Feijão comum", regime: "aliquota_zero", fundamento: anexo("I", "Cesta Básica Nacional"), conferido: false },
  { tipo: "NCM", codigo: "0401", descricao: "Leite fluido", regime: "aliquota_zero", fundamento: anexo("I", "Cesta Básica Nacional"), conferido: false, observacao: "A cesta alcança só parte das posições; conferir a descrição exata." },
  { tipo: "NCM", codigo: "1101", descricao: "Farinha de trigo", regime: "aliquota_zero", fundamento: anexo("I", "Cesta Básica Nacional"), conferido: false },
  { tipo: "NCM", codigo: "0201", descricao: "Carnes bovinas frescas ou refrigeradas", regime: "aliquota_zero", fundamento: anexo("I", "Cesta Básica Nacional"), conferido: false },
  { tipo: "NCM", codigo: "3004", descricao: "Medicamentos em doses", regime: "reducao_60", fundamento: anexo("VI", "medicamentos com redução"), conferido: false, observacao: "Parte dos medicamentos tem alíquota zero em outro anexo; conferir caso a caso." },
  { tipo: "NBS", codigo: "", descricao: "Serviços de educação (ensino infantil, fundamental, médio, superior)", regime: "reducao_60", fundamento: "EC 132/2023, art. 9º, § 1º, e LC 214/2025; dispositivo e códigos NBS a conferir", conferido: false },
  { tipo: "NBS", codigo: "", descricao: "Serviços de saúde humana", regime: "reducao_60", fundamento: "EC 132/2023, art. 9º, § 1º, e LC 214/2025; dispositivo e códigos NBS a conferir", conferido: false },
  { tipo: "NBS", codigo: "", descricao: "Serviços advocatícios e de outras profissões intelectuais regulamentadas", regime: "reducao_30", fundamento: "EC 132/2023, art. 9º, e LC 214/2025 (profissões intelectuais); dispositivo e códigos NBS a conferir", conferido: false, observacao: "A redução depende de requisitos do prestador; conferir na LC." },
  { tipo: "NBS", codigo: "", descricao: "Serviços de contabilidade, auditoria e consultoria", regime: "reducao_30", fundamento: "LC 214/2025 (profissões intelectuais); enquadramento a conferir", conferido: false },
];

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o", "para", "com", "servico", "servicos"]);

export interface ResultadoClassificacao {
  item: Classificacao;
  /** "codigo": casou pelo prefixo do código; "descricao": por termos. */
  criterio: "codigo" | "descricao";
  /** Para código: dígitos do prefixo; para descrição: termos em comum. */
  forca: number;
}

/** Busca determinística. Código: só dígitos (8 para NCM); prefixo mais longo vence. */
export function classificar(consulta: string, max = 5): ResultadoClassificacao[] {
  const digitos = consulta.replace(/\D/g, "");
  if (digitos.length >= 4 && digitos.length === consulta.replace(/[\s.\-]/g, "").length) {
    return CLASSIFICACOES.filter((c) => c.codigo && digitos.startsWith(c.codigo))
      .map((item) => ({ item, criterio: "codigo" as const, forca: item.codigo.length }))
      .sort((a, b) => b.forca - a.forca)
      .slice(0, max);
  }
  const termos = normalizar(consulta)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !PALAVRAS_VAZIAS.has(t));
  if (!termos.length) return [];
  return CLASSIFICACOES.map((item) => {
    const desc = normalizar(item.descricao);
    // Casamento por raiz simples: as 5 primeiras letras bastam para "advocaticio" ~ "advocacia".
    const forca = termos.filter((t) => desc.includes(t) || desc.includes(t.slice(0, 5))).length;
    return { item, criterio: "descricao" as const, forca };
  })
    .filter((r) => r.forca > 0)
    .sort((a, b) => b.forca - a.forca)
    .slice(0, max);
}
