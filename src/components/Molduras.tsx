/**
 * Molduras do GR Frames (cesteduardo/gr-frames), no tamanho real de cada aparelho.
 * A vitrine reduz cada uma por escala (ver .aparelho e EscalaAparelhos), então a tela
 * de dentro mantém as medidas de verdade. Sem estado: servem a páginas e a componentes de cliente.
 */

import type { ReactNode } from "react";

export const Sinal = () => (
  <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" /><rect x="5.2" y="5.6" width="3.2" height="6.4" rx="1" /><rect x="10.4" y="3" width="3.2" height="9" rx="1" /><rect x="15.6" y="0" width="3.2" height="12" rx="1" /></svg>
);
export const Wifi = () => (
  <svg width="17" height="12" viewBox="-.5 0 17 12.2" stroke="currentColor" strokeWidth=".5" strokeLinejoin="round"><path d="M.01 3.61A11.3 11.3 0 0 1 15.99 3.61L13.8 5.8A8.2 8.2 0 0 0 2.2 5.8Z" /><path d="M2.98 6.58A7.1 7.1 0 0 1 13.02 6.58L10.83 8.77A4 4 0 0 0 5.17 8.77Z" /><path d="M5.95 9.55A2.9 2.9 0 0 1 10.05 9.55L8 11.6Z" /></svg>
);
export const Bateria = () => (
  <svg width="28" height="13" viewBox="0 0 28 13"><rect x=".5" y=".5" width="24" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="21" height="9" rx="2.4" /><path d="M26 4.4v4.2c.9-.3 1.5-1.1 1.5-2.1s-.6-1.8-1.5-2.1Z" opacity=".45" /></svg>
);
export const StatusIOS = ({ classe = "" }: { classe?: string }) => (
  <div className={`ios-status ${classe}`}>
    <span className="ios-time">9:41</span>
    <span className="ios-icons"><Sinal /><Wifi /><Bateria /></span>
  </div>
);

type Moldura = { children: ReactNode; classe?: string };

export function MacBook({ children, classe = "", endereco = "app.advfin.com.br" }: Moldura & { endereco?: string }) {
  return (
    <div className={`aparelho aparelho-mac ${classe}`} data-largura="1842" aria-hidden="true">
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
                <div className="saf-field"><span className="addr">{endereco}</span></div>
              </div>
              {children}
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

export function IPhone({ children, classe = "" }: Moldura) {
  return (
    <div className={`aparelho aparelho-iphone ${classe}`} data-largura="436" aria-hidden="true">
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
                  <StatusIOS />
                  {children}
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

const IcoDuo = ({ d }: { d: ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>
);

/** iPhone Duo fechado: dobradiça à esquerda e a coluna lateral de status e navegação à direita. */
export function IPhoneDuo({ children, classe = "", hora = "9:41" }: Moldura & { hora?: string }) {
  return (
    <div className={`aparelho aparelho-duo ${classe}`} data-largura="502" aria-hidden="true">
      <div className="dev duo">
        <i className="dz-btn dz-b1" /><i className="dz-btn dz-b2" /><i className="dz-btn dz-side" />
        <i className="dz-shade" />
        <div className="dz-band">
          <i className="dz-hinge" />
          <div className="dz-bezel">
            <div className="screen dz-screen">
              {children}
              <div className="dz-col">
                <i className="dz-hole" />
                <span className="dz-time">{hora}</span>
                <span className="dz-wifi">
                  <svg className="dz-ring" viewBox="0 0 36 36"><path d="M7.16 29.22A15.6 15.6 0 1 1 28.84 29.22" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" /><g fill="currentColor"><circle cx="25.80" cy="31.51" r="1.5" /><circle cx="20.71" cy="33.36" r="1.5" /><circle cx="15.29" cy="33.36" r="1.5" /><circle cx="10.20" cy="31.51" r="1.5" /></g><path d="M10.79 14.79A10.2 10.2 0 0 1 25.21 14.79M13.83 17.83A5.9 5.9 0 0 1 22.17 17.83" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" /><circle cx="18" cy="20.6" r="1.8" fill="currentColor" /></svg>
                </span>
                <span className="dz-sp" />
                <div className="dz-dock">
                  <span><IcoDuo d={<path d="M15 5l-7 7 7 7" />} /></span>
                  <span><IcoDuo d={<><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 4v16" /></>} /></span>
                  <span><IcoDuo d={<path d="M19 12a7 7 0 1 1-2.05-4.95M19 5v4h-4" />} /></span>
                  <span><IcoDuo d={<><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>} /></span>
                </div>
                <span className="dz-sp" />
                <span className="dz-search"><IcoDuo d={<><circle cx="11" cy="11" r="6" /><path d="m15.5 15.5 4 4" /></>} /></span>
              </div>
              <div className="ios-home" />
            </div>
            <i className="rim dz-rim" />
            <div className="glare" />
          </div>
        </div>
      </div>
    </div>
  );
}
