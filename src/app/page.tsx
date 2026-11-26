import { Calculadora } from "@/components/Calculadora";
import { ListaEspera } from "@/components/ListaEspera";

const PLANOS = [
  {
    nome: "Essencial",
    publico: "Advogado autônomo",
    preco: "R$ 197",
    unidade: "/mês",
    itens: ["Pesquisa fundamentada", "Copiloto da Reforma", "Exportação para Word e PDF", "Limite mensal de consultas"],
  },
  {
    nome: "Escritório",
    publico: "3 a 20 usuários",
    preco: "R$ 249",
    unidade: "/usuário/mês",
    itens: ["Tudo do Essencial", "Base privada do escritório", "Modelos e estilo próprios", "Colaboração e papéis"],
    recomendado: true,
  },
  {
    nome: "Tributário Pro",
    publico: "Escritórios e jurídicos de empresa",
    preco: "R$ 449",
    unidade: "/usuário/mês",
    itens: ["Tudo do Escritório", "Simulador avançado de créditos", "Análise de SPED", "Monitoramento por cliente"],
  },
  {
    nome: "Corporativo",
    publico: "Grandes bancas e empresas",
    preco: "Sob consulta",
    unidade: "",
    itens: ["SSO e API", "Auditoria dedicada", "Contrato e SLA próprios"],
  },
];

export default function Inicio() {
  return (
    <>
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="topo">
        <div className="envoltorio">
          <a href="/" className="marca">
            Adv<span>Fin</span>
          </a>
          <nav aria-label="Principal">
            <a href="#calculadora">Calculadora IBS/CBS</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#planos">Planos</a>
            <a href="#lista" className="botao">
              Lista de espera
            </a>
          </nav>
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
                <a className="botao" href="#calculadora">
                  Simular IBS/CBS agora
                </a>
                <a className="botao secundario" href="#lista">
                  Entrar no beta
                </a>
              </div>
              <p className="nota-pequena">Gratuito, sem cartão. Beta para os primeiros 50 escritórios.</p>
            </div>

            <figure className="demo" aria-label="Exemplo de resposta com fonte ao lado">
              <div className="demo-barra">
                <span>Pesquisa fundamentada</span>
                <span>Vigência consultada: 26/11/2026</span>
              </div>
              <div className="demo-corpo">
                <div className="demo-resposta">
                  <p className="demo-pergunta">Em 2026, a CBS destacada na nota é devida?</p>
                  <p>
                    Em 2026 a CBS é cobrada à alíquota de 0,9% e o IBS a 0,1%, e o valor pago pode ser compensado com
                    PIS/Cofins devidos.<sup className="cit">1</sup> Trata-se de ano de teste da apuração.
                  </p>
                </div>
                <aside className="demo-fonte" aria-label="Fonte da citação 1">
                  <p>
                    <strong>1 · ADCT, art. 125</strong>
                    <br />
                    <span className="nota-pequena">Incluído pela EC 132/2023</span>
                  </p>
                  <span className="selo vigente">Vigente em 26/11/2026</span>
                  <blockquote>“Em 2026, o imposto previsto no art. 156-A será cobrado à alíquota estadual de 0,1%…”</blockquote>
                  <p className="nota-pequena">Trecho ilustrativo. No produto, o texto vem da base oficial versionada.</p>
                </aside>
              </div>
            </figure>
          </div>
        </section>

        <section id="como-funciona">
          <div className="envoltorio">
            <p className="sobretitulo">Como funciona</p>
            <h2>O que a IA escreve, o sistema confere.</h2>
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

        <section id="calculadora">
          <div className="envoltorio">
            <p className="sobretitulo">Ferramenta gratuita</p>
            <h2>Calculadora da transição IBS/CBS</h2>
            <p className="lead">
              Compare a carga de hoje com a de qualquer ano entre 2026 e 2033. Cada número mostra se vem de norma, de
              estimativa ou de premissa do cálculo.
            </p>
            <Calculadora />
          </div>
        </section>

        <section id="planos">
          <div className="envoltorio">
            <p className="sobretitulo">Planos</p>
            <h2>Assinatura mensal, em reais.</h2>
            <p className="lead">Teste de 7 dias sem cartão. Plano anual com dois meses de desconto.</p>
            <div className="planos">
              {PLANOS.map((p) => (
                <article key={p.nome} className={`plano${p.recomendado ? " recomendado" : ""}`}>
                  {p.recomendado && <p className="sobretitulo" style={{ marginBottom: 4 }}>Mais escolhido</p>}
                  <h3>{p.nome}</h3>
                  <p className="nota-pequena" style={{ margin: 0 }}>
                    {p.publico}
                  </p>
                  <p className="preco">
                    {p.preco} <small>{p.unidade}</small>
                  </p>
                  <ul>
                    {p.itens.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                  <a className={`botao${p.recomendado ? "" : " secundario"}`} href="#lista">
                    {p.preco === "Sob consulta" ? "Falar conosco" : "Entrar no beta"}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="lista">
          <div className="envoltorio espera">
            <div>
              <p className="sobretitulo">Programa fundador</p>
              <h2>Ajude a construir a ferramenta que você vai usar.</h2>
              <p className="lead">
                Os 50 primeiros escritórios têm desconto vitalício em troca de uma conversa quinzenal sobre o produto.
              </p>
            </div>
            <ListaEspera />
          </div>
        </section>
      </main>

      <footer>
        <div className="envoltorio">
          <p>
            AdvFin é uma ferramenta de apoio para profissionais do Direito e da contabilidade. Não presta serviço
            jurídico, não substitui a análise do advogado e não promete resultado. As simulações usam premissas
            declaradas e estimativas oficiais sujeitas a alteração.
          </p>
          <p>© 2026 AdvFin · Dados tratados conforme a LGPD (Lei 13.709/2018).</p>
        </div>
      </footer>
    </>
  );
}
