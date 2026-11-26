/** Nomes das ações de auditoria, como aparecem na trilha do escritório. */
export const ROTULO_ACAO: Record<string, string> = {
  cadastro: "Criou a conta do escritório",
  login: "Entrou",
  login_codigo_recuperacao: "Entrou com código de recuperação",
  consulta: "Fez uma consulta",
  caso_criado: "Criou um caso",
  inclusao_caso: "Incluiu alguém num caso",
  retirada_caso: "Retirou alguém de um caso",
  pedido_revisao: "Pediu revisão",
  revisao_aprovada: "Aprovou uma revisão",
  revisao_recusada: "Recusou uma revisão",
  exportacao_parecer: "Exportou um parecer",
  exportacao_escritorio: "Exportou todos os dados do escritório",
  exportacao_auditoria: "Exportou a trilha de auditoria",
  convite: "Convidou alguém",
  convite_reenviado: "Reenviou um convite",
  convite_cancelado: "Cancelou um convite",
  convite_liberado: "Liberou um convite acima dos assentos",
  aceite_convite: "Aceitou o convite",
  pedido_entrada: "Pediu para entrar pelo domínio",
  entrada_aprovada: "Aprovou uma entrada",
  entrada_recusada: "Recusou uma entrada",
  mudanca_nivel: "Mudou o nível de alguém",
  suspensao: "Suspendeu o acesso de alguém",
  reativacao: "Reativou o acesso de alguém",
  remocao: "Removeu alguém do escritório",
  saida: "Saiu do escritório",
  exclusao_conta: "Excluiu a própria conta",
  transferencia_titularidade: "Transferiu a titularidade",
  configuracao: "Mudou as configurações",
  troca_senha: "Trocou a senha",
  ativar_2fa: "Ativou a verificação em duas etapas",
  desativar_2fa: "Desativou a verificação em duas etapas",
  assinatura: "Assinatura atualizada pelo Stripe",
  assinatura_iniciada: "Iniciou a assinatura",
  encerramento: "Encerrou a conta do escritório",
  reabertura: "Reabriu a conta do escritório",
};

/** Limite mensal de consultas por plano, quando definido (LIMITE_CONSULTAS_ESSENCIAL etc.). */
export function limiteMensal(plano: string): number | null {
  const v = process.env[`LIMITE_CONSULTAS_${plano.toUpperCase()}`];
  return v && Number(v) > 0 ? Number(v) : null;
}
