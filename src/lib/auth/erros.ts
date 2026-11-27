/**
 * As funções do banco recusam com um código curto (raise exception 'acima_de_si').
 * Aqui cada código vira a frase que a pessoa lê. Erro sem código conhecido vira uma
 * mensagem genérica, e o detalhe vai só para o log do servidor.
 */
const MENSAGENS: Record<string, string> = {
  sem_permissao: "Seu nível de acesso não permite esta ação.",
  proprio_nivel: "Ninguém altera o próprio nível. Peça a outro administrador.",
  proprio_usuario: "Esta ação não vale para você mesmo.",
  use_transferencia: "O nível Titular só passa por transferência da titularidade.",
  titular_intocavel: "O Titular não pode ser rebaixado, suspenso ou removido. Antes, ele transfere a titularidade.",
  acima_de_si: "Você não pode dar um nível acima do seu.",
  so_titular_rebaixa_admin: "Só o Titular rebaixa um Administrador.",
  so_titular_age_sobre_admin: "Só o Titular suspende ou remove um Administrador.",
  nao_e_membro: "Esta pessoa não faz parte do escritório.",
  ja_e_membro: "Esta pessoa já faz parte do escritório.",
  transfira_antes: "Transfira a titularidade antes. O escritório precisa sempre de um Titular.",
  confirmar_assento: "Não há assento livre no plano. Confirme a inclusão de mais um assento.",
  sem_assento: "Não há assento livre no plano. O Titular precisa aumentar os assentos.",
  convite_invalido: "Este convite não vale mais: foi usado, cancelado ou venceu.",
  convite_de_outro_email: "Este convite foi enviado para outro e-mail. Entre com a conta desse e-mail.",
  email_em_uso: "Já existe uma conta com este e-mail.",
  link_invalido: "Este link não vale mais. Peça um novo.",
  dominio_de_outro_email: "O domínio precisa ser o do seu próprio e-mail.",
  dominio_diferente: "Seu e-mail não é do domínio deste escritório.",
  pedido_invalido: "Este pedido já foi decidido.",
  caso_invalido: "Caso não encontrado.",
  consulta_invalida: "Consulta não encontrada.",
  muitos_relatos: "Você já enviou muitos relatos hoje. Obrigado; a curadoria está analisando.",
  relato_invalido: "Relato não encontrado.",
  revisao_invalida: "Esta revisão já foi decidida.",
  propria_revisao: "Quem pediu a revisão não pode aprová-la.",
  "2fa_obrigatorio": "O escritório exige a verificação em duas etapas para o seu nível.",
  ja_ativo: "A verificação em duas etapas já está ativa.",
  sem_segredo: "Comece de novo a ativação da verificação em duas etapas.",
  sem_2fa: "A verificação em duas etapas não está ativa.",
  desafio_invalido: "O código venceu. Entre de novo com e-mail e senha.",
  codigo_reusado: "Este código já foi usado. Espere o próximo no aplicativo.",
  fora_da_carencia: "Os 30 dias de carência acabaram; a conta não pode mais ser reaberta.",
  nome_invalido: "Informe um nome com ao menos 2 letras.",
  uf_invalida: "Informe a UF da OAB com duas letras.",
  foto_invalida: "Envie uma imagem PNG, JPEG ou WebP.",
  sem_vinculo: "Você não tem acesso ativo a este escritório.",
  sem_usuario: "Conta não encontrada.",
  status_invalido: "Decisão inválida.",
  dispositivo_invalido: "Dispositivo não encontrado.",
};

/** Código do banco contido no erro, se houver. */
export function codigoDoBanco(e: unknown): string | null {
  // O pg entrega a mensagem do raise exatamente como foi escrita.
  const m = e instanceof Error ? e.message : String(e);
  return Object.hasOwn(MENSAGENS, m) ? m : null;
}

export function mensagemDeErro(e: unknown, padrao = "Não foi possível concluir agora. Tente de novo."): string {
  const c = codigoDoBanco(e);
  if (c) return MENSAGENS[c];
  console.error("acao", e instanceof Error ? e.message : e);
  return padrao;
}
