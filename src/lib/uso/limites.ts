import "server-only";
import { noEscritorio, type Contexto } from "@/lib/db";

/**
 * Limites de uso da pesquisa (a única tarefa que chama a IA e custa por consulta).
 *
 * Padrões por variável de ambiente; exceções por escritório na tabela limites_uso,
 * definidas pela equipe da plataforma em /admin. Consultas que deram erro não contam.
 *
 *   LIMITE_CONSULTAS_DIA          por pessoa, por dia (fuso de Brasília)     padrão 30
 *   LIMITE_CONSULTAS_MES          por pessoa, por mês                       padrão 300
 *   LIMITE_CONSULTAS_ESCRITORIO   por escritório, por mês                   padrão 1500
 *   LIMITE_CONSULTAS_MINUTO       por pessoa, em 60 segundos (anti-rajada)  padrão 6
 */
export function limitesPadrao() {
  const n = (v: string | undefined, padrao: number) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 && v !== "" && v !== undefined ? Math.floor(x) : padrao;
  };
  return {
    dia: n(process.env.LIMITE_CONSULTAS_DIA, 30),
    mes: n(process.env.LIMITE_CONSULTAS_MES, 300),
    escritorio: n(process.env.LIMITE_CONSULTAS_ESCRITORIO, 1500),
    minuto: n(process.env.LIMITE_CONSULTAS_MINUTO, 6),
  };
}

export interface Cota {
  permitido: boolean;
  motivo: "minuto" | "dia" | "mes" | "escritorio" | null;
  usadasDia: number;
  limiteDia: number;
  usadasMes: number;
  limiteMes: number;
}

export async function conferirCota(ctx: Contexto): Promise<Cota> {
  const l = limitesPadrao();
  const [r] = await noEscritorio(ctx, async (c) =>
    (await c.query(`select * from app.cota_pesquisa($1, $2, $3, $4)`, [l.dia, l.mes, l.escritorio, l.minuto])).rows,
  );
  return {
    permitido: r.permitido,
    motivo: r.motivo,
    usadasDia: r.usadas_dia,
    limiteDia: r.limite_dia,
    usadasMes: r.usadas_mes,
    limiteMes: r.limite_mes,
  };
}

export function mensagemDeCota(c: Cota): string {
  switch (c.motivo) {
    case "minuto":
      return "Muitas perguntas em sequência. Espere um minuto e tente de novo.";
    case "dia":
      return `Você chegou ao limite de ${c.limiteDia} consultas por dia no teste. A cota volta à meia-noite (horário de Brasília).`;
    case "mes":
      return `Você chegou ao limite de ${c.limiteMes} consultas neste mês no teste. Se precisar de mais, escreva para o suporte.`;
    case "escritorio":
      return "O escritório chegou ao limite mensal de consultas do teste. O titular pode pedir mais ao suporte.";
    default:
      return "Limite de uso atingido.";
  }
}
