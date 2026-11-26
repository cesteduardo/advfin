"use client";

import { useEffect, useRef, useState } from "react";
import { EMAIL_INSCRICOES } from "@/config/site";
import { CreditoGR } from "./CreditoGR";

/**
 * Política de Privacidade e Termos de Uso em pop-up (<dialog> nativo: Esc fecha, foco preso, leitor de tela anuncia).
 * Abre por qualquer link com href="#privacidade" ou "#termos", em qualquer ponto da página.
 *
 * ATENÇÃO: texto-base redigido a partir da LGPD (Lei 13.709/2018), do CDC e do Marco Civil da Internet.
 * Deve ser revisado por advogado antes do lançamento, sobretudo controlador, CNPJ e encarregado.
 */

const ATUALIZACAO = "26 de novembro de 2026";
const CONTATO = EMAIL_INSCRICOES.includes("@") ? EMAIL_INSCRICOES : "eduardo@grbrands.com.br";

type Doc = "privacidade" | "termos";

export function Legal() {
  const ref = useRef<HTMLDialogElement>(null);
  const corpo = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Doc>("privacidade");

  useEffect(() => {
    const abrir = (d: Doc) => {
      setDoc(d);
      if (!ref.current?.open) ref.current?.showModal();
      requestAnimationFrame(() => corpo.current?.scrollTo({ top: 0 }));
    };
    const clique = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href="#privacidade"], a[href="#termos"]');
      if (!a) return;
      e.preventDefault();
      abrir(a.getAttribute("href") === "#termos" ? "termos" : "privacidade");
    };
    document.addEventListener("click", clique);
    if (location.hash === "#privacidade" || location.hash === "#termos") abrir(location.hash.slice(1) as Doc);
    return () => document.removeEventListener("click", clique);
  }, []);

  const fechar = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className="legal"
      aria-labelledby="legal-titulo"
      onClick={(e) => e.target === ref.current && fechar()}
    >
      <div className="legal-caixa">
        <header className="legal-topo">
          <div className="legal-abas" role="tablist" aria-label="Documentos legais">
            {(["privacidade", "termos"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={doc === d}
                aria-controls="legal-corpo"
                className={doc === d ? "ativa" : ""}
                onClick={() => {
                  setDoc(d);
                  corpo.current?.scrollTo({ top: 0 });
                }}
              >
                {d === "privacidade" ? <><span className="so-largo">Política de </span>Privacidade</> : <>Termos<span className="so-largo"> de Uso</span></>}
              </button>
            ))}
          </div>
          <button type="button" className="legal-fechar" onClick={fechar} aria-label="Fechar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div ref={corpo} id="legal-corpo" className="legal-corpo" role="tabpanel" tabIndex={0}>
          {doc === "privacidade" ? <Privacidade /> : <Termos />}
          <p className="legal-assinatura">
            AdvFin é um projeto feito por{" "}
            <CreditoGR id="gr-legal" />
          </p>
        </div>
      </div>
    </dialog>
  );
}

function Privacidade() {
  return (
    <article>
      <h2 id="legal-titulo">Política de Privacidade</h2>
      <p className="legal-data">Última atualização: {ATUALIZACAO}</p>
      <p>
        Esta política explica quais dados pessoais o site do AdvFin trata, para quê, com quem compartilha e como você
        exerce seus direitos, nos termos da Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018, “LGPD”).
      </p>

      <h3>1. Quem é o controlador</h3>
      <p>
        O AdvFin é um projeto desenvolvido pela GR Brands, de São José do Rio Preto (SP), que atua como controladora
        dos dados tratados neste site. Contato para assuntos de privacidade: <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
      </p>

      <h3>2. Quais dados tratamos</h3>
      <ul>
        <li>
          <strong>Lista de espera:</strong> nome, e-mail profissional e perfil de atuação que você informa no
          formulário, além da data e hora do seu consentimento.
        </li>
        <li>
          <strong>Calculadora IBS/CBS:</strong> nenhum. Os valores digitados são processados apenas no seu navegador e
          não são enviados a nós nem a terceiros.
        </li>
        <li>
          <strong>Registros técnicos:</strong> o provedor de hospedagem pode registrar endereço IP, data, hora e
          página acessada, como exige o Marco Civil da Internet (Lei 12.965/2014, art. 15).
        </li>
      </ul>
      <p>Não usamos cookies de publicidade, ferramentas de rastreamento nem pixels de redes sociais.</p>

      <h3>3. Para que usamos e com qual base legal</h3>
      <ul>
        <li>
          <strong>Enviar o convite do beta e o boletim “A Reforma em uma página”</strong>, com base no seu
          consentimento (LGPD, art. 7º, I), que você pode revogar a qualquer momento.
        </li>
        <li>
          <strong>Entender o perfil de quem se interessa pelo produto</strong>, de forma agregada, para orientar o
          desenvolvimento, também com base no consentimento.
        </li>
        <li>
          <strong>Manter a segurança do site e cumprir obrigações legais</strong>, com base no cumprimento de obrigação
          legal (art. 7º, II) e no legítimo interesse (art. 7º, IX).
        </li>
      </ul>
      <p>Não vendemos dados pessoais e não os usamos para treinar modelos de inteligência artificial.</p>

      <h3>4. Com quem compartilhamos</h3>
      <p>Apenas com operadores necessários ao funcionamento do site, que tratam os dados conforme nossas instruções:</p>
      <ul>
        <li>
          <strong>FormSubmit</strong> (formsubmit.co), que encaminha as inscrições do formulário ao nosso e-mail;
        </li>
        <li>
          <strong>provedor de hospedagem</strong> do site e <strong>provedor de e-mail</strong> que recebe as
          inscrições.
        </li>
      </ul>
      <p>Podemos ainda compartilhar dados por ordem judicial ou requisição de autoridade competente.</p>

      <h3>5. Transferência internacional</h3>
      <p>
        Alguns desses fornecedores podem armazenar dados fora do Brasil. Nesses casos, a transferência ocorre com base
        no seu consentimento específico e nas demais hipóteses do art. 33 da LGPD, e escolhemos fornecedores com
        práticas de segurança compatíveis com a lei brasileira. A plataforma AdvFin, quando lançada, hospedará os dados
        de escritórios e clientes no Brasil.
      </p>

      <h3>6. Por quanto tempo guardamos</h3>
      <p>
        Os dados da lista de espera ficam guardados até o lançamento do produto e por até 12 meses depois dele, ou até
        você pedir a exclusão, o que vier primeiro. Registros técnicos seguem os prazos do Marco Civil da Internet.
      </p>

      <h3>7. Seus direitos</h3>
      <p>Pelo art. 18 da LGPD, você pode, a qualquer momento e sem custo:</p>
      <ul>
        <li>confirmar se tratamos seus dados e acessá-los;</li>
        <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
        <li>pedir anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>pedir a portabilidade dos dados;</li>
        <li>revogar o consentimento e pedir a eliminação dos dados tratados com base nele;</li>
        <li>saber com quem compartilhamos seus dados.</li>
      </ul>
      <p>
        Para exercer qualquer direito, escreva para <a href={`mailto:${CONTATO}`}>{CONTATO}</a>. Respondemos em até 15
        dias. Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD), em gov.br/anpd.
      </p>

      <h3>8. Segurança</h3>
      <p>
        Adotamos medidas técnicas e administrativas para proteger os dados contra acessos não autorizados e situações
        acidentais ou ilícitas (art. 46), como conexão criptografada (HTTPS) e acesso restrito às inscrições. Em caso
        de incidente que possa causar risco ou dano relevante, comunicaremos os titulares e a ANPD (art. 48).
      </p>

      <h3>9. Crianças e adolescentes</h3>
      <p>O site é destinado a profissionais e não coleta, de forma intencional, dados de menores de 18 anos.</p>

      <h3>10. Encarregado e contato</h3>
      <p>
        O canal de comunicação com o encarregado pelo tratamento de dados é{" "}
        <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
      </p>

      <h3>11. Alterações</h3>
      <p>
        Esta política pode ser atualizada. A data no topo indica a versão vigente; mudanças relevantes serão avisadas
        por e-mail a quem estiver na lista de espera.
      </p>
    </article>
  );
}

function Termos() {
  return (
    <article>
      <h2 id="legal-titulo">Termos de Uso</h2>
      <p className="legal-data">Última atualização: {ATUALIZACAO}</p>
      <p>
        Estes termos regulam o uso do site do AdvFin, projeto desenvolvido pela GR Brands. Ao navegar no site, usar a
        calculadora ou entrar na lista de espera, você concorda com eles.
      </p>

      <h3>1. O que é o AdvFin</h3>
      <p>
        O AdvFin é uma ferramenta de apoio em desenvolvimento, voltada a advogados, contadores e profissionais de
        tributação. Ele não presta serviço jurídico, não emite parecer, não substitui a análise de um profissional
        habilitado e não promete resultado em nenhum caso, em respeito ao Estatuto da Advocacia e ao Provimento
        205/2021 do Conselho Federal da OAB.
      </p>

      <h3>2. Calculadora IBS/CBS</h3>
      <ul>
        <li>
          A calculadora é gratuita e tem caráter informativo. Os resultados dependem dos valores que você informa e de
          premissas declaradas ao lado de cada cálculo.
        </li>
        <li>
          Parte das alíquotas é estimativa oficial ainda não fixada em norma e pode mudar. Os dispositivos citados
          estão sinalizados como “em conferência” enquanto não forem revisados pela curadoria.
        </li>
        <li>
          O resultado não deve ser usado, sozinho, para decisões fiscais, contratuais ou de preço. Confira sempre a
          legislação vigente na data da operação.
        </li>
      </ul>

      <h3>3. Lista de espera e programa fundador</h3>
      <p>
        A inscrição não cria obrigação de contratar nem garante vaga no beta. Planos, preços e condições exibidos são
        previsões e podem mudar até o lançamento; as condições finais serão apresentadas antes de qualquer cobrança.
      </p>

      <h3>4. Uso permitido</h3>
      <p>
        Você se compromete a não usar o site para fins ilícitos, não tentar acessar áreas restritas, não sobrecarregar
        a infraestrutura nem coletar dados de forma automatizada sem autorização.
      </p>

      <h3>5. Propriedade intelectual</h3>
      <p>
        Marca, textos, interface e código do AdvFin pertencem à GR Brands ou a seus licenciantes. Textos de leis e
        decisões citados são de domínio público.
      </p>

      <h3>6. Responsabilidade</h3>
      <p>
        Trabalhamos para manter o site correto e disponível, mas ele pode conter imprecisões ou ficar fora do ar. Nos
        limites da lei, inclusive do Código de Defesa do Consumidor, não respondemos por decisões tomadas apenas com
        base nas simulações do site.
      </p>

      <h3>7. Links externos</h3>
      <p>O site pode apontar para páginas de terceiros, como portais oficiais, cujo conteúdo não controlamos.</p>

      <h3>8. Privacidade</h3>
      <p>
        O tratamento de dados pessoais segue a <a href="#privacidade">Política de Privacidade</a>.
      </p>

      <h3>9. Alterações, lei e foro</h3>
      <p>
        Estes termos podem ser atualizados, e a data no topo indica a versão vigente. Aplica-se a lei brasileira. Fica
        eleito o foro do domicílio do usuário consumidor; nos demais casos, o foro da comarca de São José do Rio Preto
        (SP).
      </p>
      <p>
        Dúvidas: <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
      </p>
    </article>
  );
}
