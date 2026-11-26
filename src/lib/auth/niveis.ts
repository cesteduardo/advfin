/**
 * Níveis de acesso e ações, com os nomes que aparecem na tela.
 * Só rótulos e ordem: quem decide o que cada nível pode é o banco (app.permissoes),
 * e a sessão traz a lista já resolvida para o nível da pessoa.
 */
export const NIVEIS = ["supervisionado", "membro", "admin", "titular"] as const;
export type Nivel = (typeof NIVEIS)[number];

export const ROTULO_NIVEL: Record<Nivel, string> = {
  titular: "Titular",
  admin: "Administrador",
  membro: "Membro",
  supervisionado: "Supervisionado",
};

export const DESCRICAO_NIVEL: Record<Nivel, string> = {
  titular: "Tudo, inclusive plano, transferência da titularidade e encerramento da conta.",
  admin: "Pessoas, convites, auditoria, consumo e configurações. Não mexe no plano nem encerra a conta.",
  membro: "Usa as ferramentas, cria casos, inclui colegas e exporta pareceres.",
  supervisionado: "Usa as ferramentas; exportar e incluir colegas pedem a revisão de um Membro.",
};

export type Acao =
  | "usar_ferramentas"
  | "criar_caso"
  | "incluir_colega"
  | "exportar_parecer"
  | "enviar_documentos"
  | "ver_auditoria"
  | "gerir_pessoas"
  | "configurar_escritorio"
  | "ver_consumo"
  | "gerir_cobranca"
  | "transferir_titularidade"
  | "exportar_escritorio"
  | "encerrar_escritorio";

export const acimaOuIgual = (a: Nivel, b: Nivel) => NIVEIS.indexOf(a) >= NIVEIS.indexOf(b);

/** Níveis que quem tem `eu` pode dar a outra pessoa (nunca Titular: esse só por transferência). */
export function niveisConcedidos(eu: Nivel): Nivel[] {
  return NIVEIS.filter((n) => n !== "titular" && acimaOuIgual(eu, n)).reverse();
}

export const ROTULO_PAPEL_PLATAFORMA: Record<string, string> = {
  admin: "Administração da plataforma",
  curador: "Curadoria da base normativa",
  suporte: "Suporte",
};
