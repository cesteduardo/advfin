/**
 * Configuração pública do site. Tudo aqui vai para o navegador: não coloque segredos.
 *
 * E-mail que recebe as inscrições da lista de espera. O envio usa o FormSubmit
 * (formsubmit.co), que não exige servidor nem conta: na primeira inscrição ele manda
 * um e-mail de ativação para este endereço, e só depois disso as inscrições chegam.
 *
 * Depois de ativar, o FormSubmit oferece um apelido aleatório (ex.: "a1b2c3...") que
 * esconde o e-mail do código-fonte. Troque o endereço pelo apelido em NEXT_PUBLIC_LISTA_ESPERA_EMAIL.
 */
export const EMAIL_INSCRICOES = process.env.NEXT_PUBLIC_LISTA_ESPERA_EMAIL || "eduardo@grbrands.com.br";

export const ROTULO_PERFIL: Record<string, string> = {
  tributarista_pequeno: "Tributarista autônomo ou escritório de até 5 advogados",
  escritorio_medio: "Escritório de 6 a 50 advogados",
  juridico_interno: "Jurídico ou fiscal de empresa",
  contador: "Contador ou consultor tributário",
};
