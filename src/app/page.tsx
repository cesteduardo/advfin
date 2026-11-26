import { Aparelhos } from "@/components/Aparelhos";
import { Calculadora } from "@/components/Calculadora";
import { ListaEspera } from "@/components/ListaEspera";
import { CreditoGR } from "@/components/CreditoGR";
import { Legal } from "@/components/Legal";
import { NavIlha } from "@/components/NavIlha";
import { Planos } from "@/components/Planos";


export default function Inicio() {
  return (
    <>
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="topbar">
        <div className="ilha">
          <a href="#conteudo" className="marca" aria-label="AdvFin, início">
            <svg className="simbolo" viewBox="0 0 28 28" aria-hidden="true">
              <rect width="28" height="28" rx="9" fill="#0f2742" />
              <path d="M8 19.5h12M9.5 17V11.5M14 17V11.5M18.5 17V11.5M7.5 10 14 6.5l6.5 3.5" stroke="#d9bf86" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span>
              Adv<i>Fin</i>
            </span>
          </a>
          <NavIlha />
        </div>
      </header>

      <main id="conteudo">
        <section className="heroi">
          <div className="envoltorio heroi-grade">
            <div>
              <p className="sobretitulo">A IA do tributarista · Reforma Tributária</p>
              <h1>
                Cada resposta com a norma ao lado. <em>Cada norma com a data em que vale.</em>
              </h1>
              <p className="lead">
                Pesquisa e cálculo para a transição de 2026 a 2033, com fonte verificável em cada afirmação. A IA
                prepara; você revisa e assina.
              </p>
              <div className="acoes">
                <a className="botao ouro" href="#calculadora">
                  Simular IBS/CBS agora
                </a>
                <a className="botao secundario" href="#lista">
                  Entrar no beta
                </a>
              </div>
              <p className="nota-pequena">Gratuito, sem cartão. Beta para os primeiros 50 escritórios.</p>
            </div>

            <Aparelhos />
          </div>
        </section>

        <section id="como-funciona">
          <div className="envoltorio">
            <div className="secao-cabeca">
              <p className="sobretitulo">Como funciona</p>
              <h2>
                O que a IA escreve, <em>o sistema confere.</em>
              </h2>
            </div>
            <div className="tres">
              <div>
                <span className="numero">I.</span>
                <h3>Fonte antes de prosa</h3>
                <p>
                  Toda citação é conferida contra uma base normativa versionada por vigência. Citação que não existe
                  na base bloqueia a resposta, em vez de passar adiante.
                </p>
              </div>
              <div>
                <span className="numero">II.</span>
                <h3>Cálculo sem imaginação</h3>
                <p>
                  Alíquotas, créditos e simulações saem de um motor determinístico e auditável. O modelo de linguagem
                  explica o número; nunca o inventa.
                </p>
              </div>
              <div>
                <span className="numero">III.</span>
                <h3>Sigilo inegociável</h3>
                <p>
                  Dados hospedados no Brasil, isolados por escritório e nunca usados para treinar modelos. Trilha de
                  auditoria de tudo o que a IA produziu.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="calculadora" className="faixa">
          <div className="envoltorio">
            <div className="secao-cabeca">
              <p className="sobretitulo">Ferramenta gratuita</p>
              <h2>
                Calculadora da transição. <em>De 2026 a 2033.</em>
              </h2>
              <p className="lead">
                Compare a carga de hoje com a de qualquer ano da transição. Cada número mostra se vem de norma, de
                estimativa ou de premissa do cálculo.
              </p>
            </div>
            <Calculadora />
          </div>
        </section>

        <section id="planos">
          <div className="envoltorio">
            <div className="secao-cabeca">
              <p className="sobretitulo">Planos</p>
              <h2>
                Assinatura mensal, <em>em reais.</em>
              </h2>
              <p className="lead">Teste de 7 dias sem cartão. Plano anual com dois meses de desconto.</p>
            </div>
            <Planos />
          </div>
        </section>

        <section id="lista">
          <div className="envoltorio">
          <div className="espera">
            <div>
              <p className="sobretitulo">Programa fundador</p>
              <h2>
                Ajude a construir <em>a ferramenta que você vai usar.</em>
              </h2>
              <p className="lead">
                Os 50 primeiros escritórios têm desconto vitalício em troca de uma conversa quinzenal sobre o produto.
              </p>
            </div>
            <ListaEspera />
          </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="envoltorio">
          <div className="rodape-texto">
            <p className="marca rodape-marca">
              Adv<i>Fin</i>
            </p>
            <p>
              Ferramenta de apoio para profissionais do Direito e da contabilidade. Não presta serviço jurídico, não
              substitui a análise do advogado e não promete resultado. As simulações usam premissas declaradas e
              estimativas oficiais sujeitas a alteração.
            </p>
          </div>
          <div className="rodape-lado">
            <nav className="rodape-links" aria-label="Documentos legais">
              <a href="#privacidade">Política de Privacidade</a>
              <a href="#termos">Termos de Uso</a>
            </nav>
            <p>© 2026 AdvFin · Dados tratados conforme a LGPD (Lei 13.709/2018).</p>
            <p className="feito-por">
              <span>Feito por</span>
              <CreditoGR id="gr-rodape" />
            </p>
          </div>
        </div>
      </footer>
      <Legal />
    </>
  );
}
