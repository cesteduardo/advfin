/**
 * Vitrine do herói: a mesma resposta no Mac (tela larga, fonte ao lado)
 * e no iPhone (conversa, fonte embaixo). As molduras são CSS puro, sem imagem,
 * e o conteúdo escala com a tela (unidades de contêiner), como uma fotografia.
 */

const DATA = "26/11/2026";
const TRECHO = "“Em 2026, o imposto previsto no art. 156-A será cobrado à alíquota estadual de 0,1%…”";

function Simbolo() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="9" fill="#0f2742" />
      <path d="M8 19.5h12M9.5 17V11.5M14 17V11.5M18.5 17V11.5M7.5 10 14 6.5l6.5 3.5" stroke="#d9bf86" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Mac() {
  return (
    <div className="mac" aria-hidden="true">
      <div className="mac-tampa">
        <span className="mac-camera" />
        <div className="mac-tela">
          <div className="mac-janela">
            <div className="mac-barra">
              <span className="semaforo"><i /><i /><i /></span>
              <span className="mac-endereco">advfin.com.br/pesquisa</span>
            </div>
            <div className="demo-barra">
              <span>Pesquisa fundamentada</span>
              <span>Vigência consultada: {DATA}</span>
            </div>
            <div className="demo-corpo">
              <div className="demo-resposta">
                <p className="demo-pergunta">Em 2026, a CBS destacada na nota é devida?</p>
                <p>
                  Em 2026 a CBS é cobrada à alíquota de 0,9% e o IBS a 0,1%, e o valor pago pode ser compensado com
                  PIS/Cofins devidos.<sup className="cit">1</sup> Trata-se de ano de teste da apuração.
                </p>
              </div>
              <div className="demo-fonte">
                <p>
                  <strong>1 · ADCT, art. 125</strong>
                  <br />
                  <span className="nota-pequena">Incluído pela EC 132/2023</span>
                </p>
                <span className="selo vigente">Vigente em {DATA}</span>
                <blockquote>{TRECHO}</blockquote>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mac-base"><span /></div>
    </div>
  );
}

function IPhone() {
  return (
    <div className="iphone" aria-hidden="true">
      <span className="iphone-botao acao" />
      <span className="iphone-botao volume-mais" />
      <span className="iphone-botao volume-menos" />
      <span className="iphone-botao lateral" />
      <div className="iphone-tela">
        <div className="iphone-status">
          <span>9:41</span>
          <span className="ilha-dinamica" />
          <span className="iphone-icones">
            <svg viewBox="0 0 18 12"><path d="M1 11h2V8H1zm4.5 0h2V6h-2zM10 11h2V3.5h-2zm4.5 0h2V1h-2z" fill="currentColor" /></svg>
            <svg viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" /><path d="M24 4v4c.8-.3 1.3-1.1 1.3-2S24.8 4.3 24 4z" fill="currentColor" opacity=".45" /></svg>
          </span>
        </div>
        <div className="app-topo">
          <span className="app-marca"><Simbolo /><span>Adv<i>Fin</i></span></span>
          <span className="app-data">Vigência {DATA}</span>
        </div>
        <div className="app-conversa">
          <p className="bolha eu">Em 2026, a CBS destacada na nota é devida?</p>
          <div className="bolha ia">
            <p>
              Sim. Em 2026 a CBS é cobrada a 0,9% e o IBS a 0,1%, compensáveis com PIS/Cofins devidos.
              <sup className="cit">1</sup>
            </p>
            <div className="app-fonte">
              <strong>1 · ADCT, art. 125</strong>
              <span className="selo vigente">Vigente em {DATA}</span>
              <blockquote>{TRECHO}</blockquote>
            </div>
          </div>
          <div className="app-sugestoes">
            <span>Simular 2027</span>
            <span>Texto integral</span>
            <span>Anexar ao caso</span>
          </div>
        </div>
        <div className="app-campo">
          <span>Pergunte sobre a transição…</span>
          <span className="app-enviar">
            <svg viewBox="0 0 16 16"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
        <span className="iphone-indicador" />
      </div>
    </div>
  );
}

export function Aparelhos() {
  return (
    <figure className="aparelhos">
      <Mac />
      <IPhone />
      <figcaption className="so-leitor">
        Exemplo de resposta: em 2026 a CBS é cobrada a 0,9% e o IBS a 0,1%, compensáveis com PIS/Cofins. Fonte
        citada ao lado: ADCT, art. 125, incluído pela EC 132/2023, vigente em {DATA}. Trecho ilustrativo; no produto,
        o texto vem da base oficial versionada.
      </figcaption>
      <p className="aparelhos-nota" aria-hidden="true">Trecho ilustrativo. No produto, o texto vem da base oficial versionada.</p>
    </figure>
  );
}
