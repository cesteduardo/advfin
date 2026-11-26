/**
 * Vitrine do herói com as molduras do GR Frames (cesteduardo/gr-frames):
 * MacBook Pro 14" prateado e iPhone 18 Pro Deep Blue, desenhados em CSS no
 * tamanho real e reduzidos por escala, para a tela de dentro ter as medidas
 * de um aparelho de verdade (1512 × 982 no Mac, 402 × 874 no iPhone).
 */

import { EscalaAparelhos } from "./EscalaAparelhos";

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

const Sinal = () => (
  <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" /><rect x="5.2" y="5.6" width="3.2" height="6.4" rx="1" /><rect x="10.4" y="3" width="3.2" height="9" rx="1" /><rect x="15.6" y="0" width="3.2" height="12" rx="1" /></svg>
);
const Wifi = () => (
  <svg width="17" height="12" viewBox="-.5 0 17 12.2" stroke="currentColor" strokeWidth=".5" strokeLinejoin="round"><path d="M.01 3.61A11.3 11.3 0 0 1 15.99 3.61L13.8 5.8A8.2 8.2 0 0 0 2.2 5.8Z" /><path d="M2.98 6.58A7.1 7.1 0 0 1 13.02 6.58L10.83 8.77A4 4 0 0 0 5.17 8.77Z" /><path d="M5.95 9.55A2.9 2.9 0 0 1 10.05 9.55L8 11.6Z" /></svg>
);
const Bateria = () => (
  <svg width="28" height="13" viewBox="0 0 28 13"><rect x=".5" y=".5" width="24" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="21" height="9" rx="2.4" /><path d="M26 4.4v4.2c.9-.3 1.5-1.1 1.5-2.1s-.6-1.8-1.5-2.1Z" opacity=".45" /></svg>
);

const Sugestoes = () => (
  <div className="app-sugestoes">
    <span>Simular 2027</span>
    <span>Texto integral</span>
    <span>Anexar ao caso</span>
  </div>
);

function MacBook() {
  return (
    <div className="aparelho aparelho-mac" data-largura="1842" aria-hidden="true">
      <div className="dev macbook">
        <div className="mb-lid">
          <div className="mb-bezel">
            <div className="screen mb-screen">
              <div className="mac-menu">
                <div className="l"><b>Safari</b><span>Arquivo</span><span>Editar</span><span>Visualizar</span><span>Histórico</span><span>Janela</span></div>
                <div className="r"><Wifi /><span>qui. 26 de nov. 9:41</span></div>
              </div>
              <div className="saf-mac">
                <div className="lights"><i /><i /><i /></div>
                <div className="saf-field"><span className="addr">advfin.com.br/pesquisa</span></div>
              </div>
              <div className="viewport mac-conteudo">
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
                    <Sugestoes />
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
              <div className="mb-notch"><i /></div>
            </div>
            <i className="rim mb-rim" />
            <div className="glare" />
          </div>
        </div>
        <div className="mb-hinge" />
        <div className="mb-base"><i /></div>
        <div className="mb-feet"><i /><i /></div>
        <i className="floor mb-floor" />
      </div>
    </div>
  );
}

function IPhone() {
  return (
    <div className="aparelho aparelho-iphone" data-largura="436" aria-hidden="true">
      <div className="dev iphone">
        <div className="ip-body">
          <i className="ip-btn l ip-action" /><i className="ip-btn l ip-volup" /><i className="ip-btn l ip-voldn" />
          <i className="ip-btn r ip-power" />
          <div className="ip-band">
            <i className="ip-btn r ip-cam" />
            <div className="ip-bezel">
              <i className="ip-ear" />
              <div className="screen ip-screen">
                <div className="scr-in">
                  <div className="ios-status">
                    <span className="ios-time">9:41</span>
                    <span className="ios-icons"><Sinal /><Wifi /><Bateria /></span>
                  </div>
                  <div className="viewport app">
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
                      <Sugestoes />
                    </div>
                    <div className="app-campo">
                      <span>Pergunte sobre a transição…</span>
                      <span className="app-enviar">
                        <svg viewBox="0 0 16 16"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    </div>
                  </div>
                  <div className="ios-home" />
                </div>
                <div className="ip-island" />
              </div>
              <i className="rim ip-rim" />
              <div className="glare" />
            </div>
          </div>
          <i className="ant al" /><i className="ant ar" /><i className="ant bl" /><i className="ant br" />
        </div>
      </div>
    </div>
  );
}

export function Aparelhos() {
  return (
    <figure className="vitrine">
      <div className="vitrine-palco">
        <MacBook />
        <IPhone />
      </div>
      <EscalaAparelhos />
      <figcaption className="so-leitor">
        Exemplo de resposta: em 2026 a CBS é cobrada a 0,9% e o IBS a 0,1%, compensáveis com PIS/Cofins. Fonte
        citada ao lado: ADCT, art. 125, incluído pela EC 132/2023, vigente em {DATA}.
      </figcaption>
      <p className="vitrine-nota" aria-hidden="true">Trecho ilustrativo. No produto, o texto vem da base oficial versionada.</p>
    </figure>
  );
}
