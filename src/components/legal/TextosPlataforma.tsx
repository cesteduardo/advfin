/**
 * Termos de Uso e Política de Privacidade da plataforma (área logada e teste público).
 *
 * A landing tem os seus próprios textos (src/components/Legal.tsx), que tratam só da
 * lista de espera e da calculadora. Estes tratam de conta, escritório, consultas e IA.
 *
 * ATENÇÃO: texto-base redigido a partir da LGPD, do Estatuto da Advocacia (Lei 8.906/1994),
 * do Código de Ética e Disciplina da OAB, do Provimento 205/2021 do CFOAB, das recomendações
 * do CFOAB sobre IA generativa (nov/2024), do Marco Civil e do CDC. Precisa da revisão de um
 * advogado antes de sair do teste, sobretudo controlador, CNPJ e encarregado (CONTROLADOR).
 * Mudança relevante no texto: troque VERSAO_TERMOS em src/lib/legal/versao.ts.
 */
import Link from "next/link";
import { EMAIL_INSCRICOES } from "@/config/site";
import { DATA_TERMOS, VERSAO_TERMOS } from "@/lib/legal/versao";

const CONTATO = EMAIL_INSCRICOES.includes("@") ? EMAIL_INSCRICOES : "eduardo@grbrands.com.br";

/** Preencha o CNPJ e o encarregado antes de sair do teste público. */
export const CONTROLADOR = {
  nome: "GR Brands",
  cidade: "São José do Rio Preto (SP)",
  cnpj: process.env.NEXT_PUBLIC_CONTROLADOR_CNPJ ?? "",
  encarregado: process.env.NEXT_PUBLIC_ENCARREGADO_NOME ?? "",
  email: CONTATO,
};

const Email = () => <a href={`mailto:${CONTATO}`}>{CONTATO}</a>;

export const SECOES_TERMOS = [
  ["t1", "O que é o AdvFin"],
  ["t2", "Quem pode usar"],
  ["t3", "Teste público"],
  ["t4", "Natureza das respostas"],
  ["t5", "Seus deveres como profissional"],
  ["t6", "Usos proibidos"],
  ["t7", "Limites de uso"],
  ["t8", "Conta, escritório e níveis"],
  ["t9", "Dados do escritório"],
  ["t10", "Relatos e melhoria da base"],
  ["t11", "Propriedade intelectual"],
  ["t12", "Responsabilidade"],
  ["t13", "Suspensão e encerramento"],
  ["t14", "Alterações, lei e foro"],
] as const;

export function TermosPlataforma() {
  return (
    <article>
      <h2 id="legal-titulo">Termos de Uso da plataforma</h2>
      <p className="legal-data">
        Versão {VERSAO_TERMOS} · vigente desde {DATA_TERMOS}
      </p>
      <p>
        Estes termos regulam o uso da plataforma AdvFin (pesquisa fundamentada, copiloto da Reforma Tributária, casos e
        demais recursos da área logada). Ao criar a conta ou aceitar um convite, você declara que leu e concorda com eles e
        com a <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h3 id="t1">1. O que é o AdvFin</h3>
      <p>
        O AdvFin é uma <strong>ferramenta de apoio ao trabalho do advogado e do profissional de tributação</strong>. Ele
        pesquisa normas da Reforma Tributária, mostra o trecho original de cada dispositivo com a vigência, faz simulações
        por cálculo determinístico e pode redigir respostas com inteligência artificial a partir desses trechos.
      </p>
      <p>
        O AdvFin <strong>não presta serviço jurídico</strong>, não emite parecer, não dá consultoria a leigos e não
        substitui a análise de um profissional habilitado. A interpretação, a decisão e a assinatura são sempre suas.
      </p>

      <h3 id="t2">2. Quem pode usar</h3>
      <ul>
        <li>advogados regularmente inscritos na OAB, estagiários sob supervisão e profissionais de tributação (contadores, consultores, equipes fiscais e jurídicas de empresas);</li>
        <li>maiores de 18 anos, que usem a plataforma no exercício da profissão.</li>
      </ul>
      <p>
        A plataforma não se destina ao público em geral. Quem não é profissional não deve usá-la para resolver questões
        jurídicas próprias ou de terceiros.
      </p>

      <h3 id="t3">3. Teste público</h3>
      <p>
        Durante o teste público, o uso é gratuito e as funções podem mudar, ficar indisponíveis ou ser retiradas sem aviso.
        Não há garantia de disponibilidade nem de prazo de resposta. A base normativa ainda está em curadoria: cada
        dispositivo aparece com um selo que diz se já foi conferido pelo tributarista curador. Ao fim do teste, avisaremos
        com antecedência quais planos e preços passam a valer; nenhuma cobrança acontece sem a sua contratação expressa.
      </p>

      <h3 id="t4">4. Natureza das respostas</h3>
      <ul>
        <li>As respostas são preparadas por sistemas automatizados, incluindo modelos de linguagem (inteligência artificial), e podem conter erros, omissões ou desatualizações.</li>
        <li>Toda resposta redigida passa por um verificador que confere se cada citação existe na base e foi transcrita literalmente. A verificação reduz, mas não elimina, o risco de erro: ela não garante que o dispositivo citado seja o mais adequado ao caso nem que a base esteja completa.</li>
        <li>A base cobre, nesta fase, o núcleo da Reforma (Emenda Constitucional 132/2023 e Lei Complementar 214/2025). Normas infralegais, regulamentos, atos do Comitê Gestor e jurisprudência podem não estar presentes.</li>
        <li>Os cálculos e simulações dependem das premissas que você informa e de alíquotas que, em parte, ainda não foram fixadas em norma.</li>
      </ul>

      <h3 id="t5">5. Seus deveres como profissional</h3>
      <p>Em linha com as recomendações do Conselho Federal da OAB sobre o uso de IA generativa, você se compromete a:</p>
      <ul>
        <li><strong>conferir</strong> cada citação no texto oficial e a vigência na data relevante antes de usar o conteúdo em peça, parecer ou orientação;</li>
        <li><strong>supervisionar</strong> o uso da plataforma por estagiários e colaboradores do escritório;</li>
        <li><strong>preservar o sigilo profissional</strong>: inserir apenas os dados do cliente necessários à pesquisa, de preferência sem nome, CPF ou CNPJ;</li>
        <li><strong>informar o cliente</strong> sobre o uso de ferramentas de IA quando a ética profissional ou o contrato assim exigirem;</li>
        <li>manter a senha em segredo e ativar a verificação em duas etapas quando o escritório exigir.</li>
      </ul>

      <h3 id="t6">6. Usos proibidos</h3>
      <ul>
        <li>oferecer a terceiros, como serviço próprio, respostas da plataforma sem a análise de profissional habilitado;</li>
        <li>usar o nome ou o conteúdo do AdvFin em publicidade que prometa resultado, capte clientela ou contrarie o Provimento 205/2021 do CFOAB e o Código de Ética e Disciplina da OAB;</li>
        <li>tentar burlar os limites de uso, o isolamento entre escritórios ou o verificador de citações;</li>
        <li>coletar dados de forma automatizada, fazer engenharia reversa, revender acesso ou sobrecarregar a infraestrutura;</li>
        <li>inserir conteúdo ilícito, dados sensíveis desnecessários ou dados de pessoas sem base legal para tratá-los.</li>
      </ul>

      <h3 id="t7">7. Limites de uso</h3>
      <p>
        Cada pesquisa tem custo de processamento. Por isso há limites de consultas por pessoa (por minuto, por dia e por mês)
        e por escritório (por mês). Ao atingir um limite, a plataforma avisa e a cota volta no período seguinte. O suporte
        pode ampliar os limites de um escritório, por exemplo no programa fundador.
      </p>

      <h3 id="t8">8. Conta, escritório e níveis</h3>
      <p>
        A conta é pessoal e intransferível. Cada escritório tem um Titular, que responde pela conta do escritório e define,
        com os Administradores, quem entra e com qual nível de acesso. O que acontece no escritório fica registrado na
        trilha de auditoria.
      </p>

      <h3 id="t9">9. Dados do escritório</h3>
      <p>
        Casos, consultas, simulações e documentos pertencem ao escritório. Em relação aos dados pessoais de clientes que você
        insere, o escritório é o controlador e o AdvFin atua como operador, tratando-os só para prestar o serviço. Os dados
        de um escritório nunca aparecem para outro e <strong>nunca são usados para treinar modelos de IA</strong>. O
        Titular pode exportar tudo a qualquer momento e encerrar a conta do escritório; depois do encerramento, há 30 dias
        para reabrir, e então os dados são apagados.
      </p>

      <h3 id="t10">10. Relatos e melhoria da base</h3>
      <p>
        Cada fonte citada tem o botão “Relatar citação errada”. O relato vai para a curadoria com o dispositivo, o trecho e o
        motivo; a sua pergunta não vai junto. Não escreva dados de clientes no comentário. Correções aprovadas pela curadoria
        valem para todos os usuários.
      </p>

      <h3 id="t11">11. Propriedade intelectual</h3>
      <p>
        Marca, interface, código e organização da base pertencem à {CONTROLADOR.nome} ou a seus licenciantes. Textos de lei
        e decisões são de domínio público. O conteúdo que você produz com a plataforma é seu e do seu escritório.
      </p>

      <h3 id="t12">12. Responsabilidade</h3>
      <p>
        Trabalhamos para manter a base correta e o serviço disponível, mas, nos limites da lei, não respondemos por decisões
        tomadas, peças protocoladas ou orientações dadas sem a conferência profissional prevista nestes termos, nem por
        indisponibilidade durante o teste público. Nada nestes termos afasta direitos que a lei garanta e que não possam ser
        afastados por contrato.
      </p>

      <h3 id="t13">13. Suspensão e encerramento</h3>
      <p>
        Podemos suspender o acesso de quem violar estes termos ou puser em risco a segurança da plataforma ou de outros
        escritórios, com aviso sempre que possível. Você pode excluir a sua conta a qualquer momento, em Perfil.
      </p>

      <h3 id="t14">14. Alterações, lei e foro</h3>
      <p>
        Estes termos podem mudar. Mudanças relevantes ganham nova versão e pedem novo aceite. Aplica-se a lei brasileira. Fica
        eleito o foro da comarca de {CONTROLADOR.cidade}, salvo quando a lei garantir ao usuário o foro do próprio
        domicílio. Dúvidas: <Email />.
      </p>
    </article>
  );
}

export const SECOES_PRIVACIDADE = [
  ["p1", "Quem trata os dados"],
  ["p2", "Quais dados"],
  ["p3", "Para quê e com qual base legal"],
  ["p4", "Inteligência artificial"],
  ["p5", "Onde os dados ficam"],
  ["p6", "Com quem compartilhamos"],
  ["p7", "Por quanto tempo"],
  ["p8", "Seus direitos"],
  ["p9", "Segurança"],
  ["p10", "Cookies"],
  ["p11", "Encarregado e contato"],
  ["p12", "Alterações"],
] as const;

export function PrivacidadePlataforma() {
  return (
    <article>
      <h2 id="legal-titulo">Política de Privacidade da plataforma</h2>
      <p className="legal-data">
        Versão {VERSAO_TERMOS} · vigente desde {DATA_TERMOS}
      </p>
      <p>
        Esta política explica como a plataforma AdvFin trata dados pessoais, nos termos da Lei Geral de Proteção de Dados
        Pessoais (Lei 13.709/2018, “LGPD”). Ela vale para a área logada; a landing page e a lista de espera têm política
        própria, no rodapé do site.
      </p>

      <h3 id="p1">1. Quem trata os dados</h3>
      <ul>
        <li>
          <strong>Dados da sua conta</strong> (cadastro, acesso, uso): a controladora é a {CONTROLADOR.nome}, de{" "}
          {CONTROLADOR.cidade}
          {CONTROLADOR.cnpj ? `, CNPJ ${CONTROLADOR.cnpj}` : ""}.
        </li>
        <li>
          <strong>Dados de clientes que o escritório insere</strong> em perguntas, casos e documentos: o controlador é o
          escritório, e o AdvFin é operador (art. 5º, VI e VII), tratando-os apenas conforme as instruções do escritório e
          para prestar o serviço.
        </li>
      </ul>

      <h3 id="p2">2. Quais dados</h3>
      <ul>
        <li><strong>Cadastro:</strong> nome, e-mail, senha (guardada só como hash), nome do escritório e, se você informar, número da OAB e foto.</li>
        <li><strong>Acesso:</strong> sessões abertas, aparelho e navegador, cidade aproximada, datas de acesso e, se ativada, a verificação em duas etapas (segredo cifrado).</li>
        <li><strong>Uso:</strong> perguntas, respostas, citações, casos, simulações, exportações e a trilha de auditoria do escritório; a contagem de consultas para os limites de uso.</li>
        <li><strong>Aceite:</strong> a versão destes termos que você aceitou, com data e hora.</li>
        <li><strong>Relatos de citação:</strong> o dispositivo, o trecho, o motivo e o comentário que você escrever.</li>
        <li><strong>Registros técnicos de erro:</strong> rota, mensagem técnica, horário, conta e escritório. O conteúdo das consultas não entra nesses registros.</li>
        <li><strong>Cobrança</strong>, quando houver plano pago: identificadores do cliente e da assinatura. O cartão fica só com o processador de pagamento.</li>
      </ul>

      <h3 id="p3">3. Para quê e com qual base legal</h3>
      <ul>
        <li><strong>Prestar o serviço</strong> (conta, pesquisa, casos, colaboração): execução de contrato (art. 7º, V).</li>
        <li><strong>Segurança, prevenção de fraude e correção de erros</strong>: legítimo interesse (art. 7º, IX) e dever de segurança (art. 46).</li>
        <li><strong>Provar o aceite e responder a demandas</strong>: exercício regular de direitos (art. 7º, VI).</li>
        <li><strong>Obrigações legais e fiscais</strong>: cumprimento de obrigação legal (art. 7º, II).</li>
        <li><strong>Melhorar a base normativa</strong> a partir dos relatos: legítimo interesse (art. 7º, IX).</li>
      </ul>
      <p>
        Não vendemos dados, não fazemos publicidade direcionada e <strong>não usamos dados de escritórios ou de clientes
        para treinar modelos de IA</strong>.
      </p>

      <h3 id="p4">4. Inteligência artificial</h3>
      <p>
        Para redigir uma resposta, a plataforma envia ao fornecedor do modelo de linguagem a sua pergunta e os trechos de
        lei recuperados da base. Hoje o fornecedor é a <strong>Anthropic</strong> (Estados Unidos), pela API comercial, cujos
        termos vedam o uso desses dados para treinar modelos. Por isso:
      </p>
      <ul>
        <li>evite colocar na pergunta nome, CPF, CNPJ ou outros dados que identifiquem o cliente: a pesquisa funciona igual sem eles;</li>
        <li>documentos privados do escritório não são enviados ao modelo nesta fase;</li>
        <li>o envio é uma transferência internacional de dados, feita com base no art. 33 da LGPD (cumprimento de contrato e garantias contratuais do fornecedor).</li>
      </ul>

      <h3 id="p5">5. Onde os dados ficam</h3>
      <p>
        O banco de dados fica no Brasil, em São Paulo, e a aplicação roda em servidores na mesma região. Alguns operadores
        (modelo de linguagem, envio de e-mail, pagamento) processam dados fora do Brasil, nas condições do item anterior.
        Cada escritório é isolado dos demais no próprio banco de dados.
      </p>

      <h3 id="p6">6. Com quem compartilhamos</h3>
      <p>Somente com operadores necessários ao serviço, contratados com dever de confidencialidade:</p>
      <ul>
        <li>hospedagem da aplicação (Vercel) e do banco de dados (Supabase);</li>
        <li>modelo de linguagem (Anthropic);</li>
        <li>envio de e-mails transacionais, como convites e confirmações (Resend), quando ativado;</li>
        <li>processamento de pagamentos (Stripe), quando houver plano pago.</li>
      </ul>
      <p>Também podemos compartilhar dados por ordem judicial ou requisição de autoridade competente.</p>

      <h3 id="p7">7. Por quanto tempo</h3>
      <ul>
        <li>Conta: enquanto existir. Depois de excluída, os dados pessoais são apagados ou anonimizados em até 15 dias.</li>
        <li>Escritório encerrado: 30 dias para reabrir; depois, tudo é apagado.</li>
        <li>Sessões: até expirar ou serem encerradas. Registros de erro: 90 dias. Comentários de relatos: até 180 dias depois da decisão da curadoria.</li>
        <li>Aceite dos termos e dados de cobrança: pelo prazo necessário para exercer direitos e cumprir obrigações fiscais.</li>
      </ul>

      <h3 id="p8">8. Seus direitos</h3>
      <p>
        Pelo art. 18 da LGPD, você pode confirmar o tratamento, acessar, corrigir, pedir anonimização, bloqueio ou eliminação,
        portabilidade e informação sobre compartilhamento. Na própria plataforma, em <strong>Perfil</strong>, você baixa os
        seus dados e exclui a conta. Para o restante, escreva para <Email />; respondemos em até 15 dias. Pedidos sobre dados
        de clientes inseridos por um escritório são encaminhados a esse escritório, que é o controlador. Você também pode
        reclamar à Autoridade Nacional de Proteção de Dados (gov.br/anpd).
      </p>

      <h3 id="p9">9. Segurança</h3>
      <p>
        Usamos conexão criptografada, senhas com hash forte, verificação em duas etapas, isolamento por escritório no banco de
        dados, trilha de auditoria e acesso restrito da equipe, que não vê o conteúdo das consultas. Em caso de incidente com
        risco ou dano relevante, comunicaremos os titulares afetados e a ANPD (art. 48).
      </p>

      <h3 id="p10">10. Cookies</h3>
      <p>
        A área logada usa apenas cookies estritamente necessários: o da sessão e, durante o login, o da verificação em duas
        etapas. Não usamos cookies de publicidade nem rastreadores de terceiros.
      </p>

      <h3 id="p11">11. Encarregado e contato</h3>
      <p>
        {CONTROLADOR.encarregado ? `Encarregado pelo tratamento de dados: ${CONTROLADOR.encarregado}. ` : ""}Canal do
        encarregado: <Email />.
      </p>

      <h3 id="p12">12. Alterações</h3>
      <p>
        Esta política pode mudar. A versão e a data no topo indicam a vigente; mudanças relevantes ganham nova versão e são
        avisadas na plataforma.
      </p>
    </article>
  );
}
