/**
 * Vitrine do herói com as molduras do GR Frames (cesteduardo/gr-frames):
 * MacBook Pro 14" prateado, iPhone Duo aberto (Night Sky) e iPhone 18 Pro (Deep Blue).
 * Cada aparelho é desenhado no tamanho real e reduzido por escala, então cada
 * tela tem as medidas de verdade e um conteúdo pensado para aquele formato:
 * o Mac mostra a mesa de trabalho, o Duo a simulação e o iPhone a conversa.
 * Os números do Duo saem do motor determinístico, não de texto fixo.
 */

import type { ReactNode } from "react";
import { linhaDoTempo } from "@/lib/tax/engine";
import { formatarPercentual, formatarReais } from "@/lib/tax/money";
import { EscalaAparelhos } from "./EscalaAparelhos";

const DATA = "26/11/2026";
const TRECHO = "“Em 2026, o imposto previsto no art. 156-A será cobrado à alíquota estadual de 0,1%…”";

/* Exemplo da simulação: serviço de R$ 10.000,00 com PIS/Cofins 9,25% e ISS 5%, regime padrão. */
const EXEMPLO = linhaDoTempo({ valor: 1_000_000, regime: "padrao", atual: { pisCofins: 92_500, icms: 0, iss: 50_000 } });
const ANO_EM_FOCO = 2027;

function Simbolo() {
  return (
    <svg className="simbolo-app" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="9" fill="#0f2742" />
      <path d="M8 19.5h12M9.5 17V11.5M14 17V11.5M18.5 17V11.5M7.5 10 14 6.5l6.5 3.5" stroke="#d9bf86" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

const Marca = () => (
  <span className="app-marca"><Simbolo /><span>Adv<i>Fin</i></span></span>
);

const Sinal = () => (
  <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" /><rect x="5.2" y="5.6" width="3.2" height="6.4" rx="1" /><rect x="10.4" y="3" width="3.2" height="9" rx="1" /><rect x="15.6" y="0" width="3.2" height="12" rx="1" /></svg>
);
const Wifi = () => (
  <svg width="17" height="12" viewBox="-.5 0 17 12.2" stroke="currentColor" strokeWidth=".5" strokeLinejoin="round"><path d="M.01 3.61A11.3 11.3 0 0 1 15.99 3.61L13.8 5.8A8.2 8.2 0 0 0 2.2 5.8Z" /><path d="M2.98 6.58A7.1 7.1 0 0 1 13.02 6.58L10.83 8.77A4 4 0 0 0 5.17 8.77Z" /><path d="M5.95 9.55A2.9 2.9 0 0 1 10.05 9.55L8 11.6Z" /></svg>
);
const Bateria = () => (
  <svg width="28" height="13" viewBox="0 0 28 13"><rect x=".5" y=".5" width="24" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="21" height="9" rx="2.4" /><path d="M26 4.4v4.2c.9-.3 1.5-1.1 1.5-2.1s-.6-1.8-1.5-2.1Z" opacity=".45" /></svg>
);
const StatusIOS = ({ classe = "" }: { classe?: string }) => (
  <div className={`ios-status ${classe}`}>
    <span className="ios-time">9:41</span>
    <span className="ios-icons"><Sinal /><Wifi /><Bateria /></span>
  </div>
);

/* Ícones de traço simples, no desenho das abas do app */
const ICONES: Record<string, ReactNode> = {
  pesquisa: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  calculo: <><rect x="5" y="3.5" width="14" height="17" rx="3" /><path d="M8.5 8h7M8.5 12.5h1.5M14 12.5h1.5M8.5 16.5h1.5M14 16.5h1.5" /></>,
  casos: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3l2 2h6A2.5 2.5 0 0 1 20 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" /></>,
  auditoria: <><path d="M12 3.5 5 6.5v5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9v-5Z" /><path d="m9 12 2 2 4-4" /></>,
};
const Icone = ({ nome }: { nome: keyof typeof ICONES }) => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONES[nome]}</svg>
);

function Fonte({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="cartao-fonte">
      <div className="cartao-fonte-topo">
        <strong>1 · ADCT, art. 125</strong>
        <span className="selo vigente">Vigente em {DATA}</span>
      </div>
      {compacta ? null : <span className="cartao-fonte-sub">Incluído pela EC 132/2023</span>}
      <blockquote>{TRECHO}</blockquote>
    </div>
  );
}

/* ---------- MacBook: a mesa de trabalho do escritório ---------- */
function TelaMac() {
  return (
    <div className="viewport tela-mac">
      <aside className="mac-lateral">
        <Marca />
        <nav>
          <span className="ativo"><Icone nome="pesquisa" />Pesquisa</span>
          <span><Icone nome="calculo" />Calculadora</span>
          <span><Icone nome="casos" />Casos</span>
          <span><Icone nome="auditoria" />Auditoria</span>
        </nav>
        <p className="mac-rotulo">Casos recentes</p>
        <ul>
          <li className="ativo">Clínica Aurora Ltda.</li>
          <li>Transportes Vale</li>
          <li>Grupo Horizonte</li>
        </ul>
      </aside>
      <main className="mac-principal">
        <header className="mac-topo">
          <div>
            <p className="mac-trilha">Casos / Clínica Aurora Ltda.</p>
            <h4>Destaque da CBS na transição</h4>
          </div>
          <div className="pilulas">
            <span className="ativo">Resposta</span>
            <span>Cálculo</span>
            <span>Trilha</span>
          </div>
        </header>
        <div className="mac-grade">
          <section className="mac-conversa">
            <p className="mac-pergunta">Em 2026, a CBS destacada na nota é devida?</p>
            <div className="mac-resposta">
              <p className="mac-autor"><Simbolo /> AdvFin · revisão pendente</p>
              <p>
                Em 2026 a CBS é cobrada à alíquota de 0,9% e o IBS a 0,1%, e o valor pago pode ser compensado com
                PIS/Cofins devidos.<sup className="cit">1</sup> Trata-se de ano de teste da apuração.
              </p>
              <div className="mac-acoes">
                <span className="primaria">Revisar e assinar</span>
                <span>Simular 2027</span>
                <span>Exportar parecer</span>
              </div>
            </div>
            <div className="mac-auditoria">
              <p className="mac-rotulo">Trilha de auditoria</p>
              <ul>
                <li><i className="ok" />Citação conferida na base versionada<span>9:41</span></li>
                <li><i className="ok" />Vigência confirmada em {DATA}<span>9:41</span></li>
                <li><i />Aguardando revisão do advogado<span>agora</span></li>
              </ul>
            </div>
          </section>
          <aside className="mac-fontes">
            <p className="mac-rotulo">Fontes conferidas</p>
            <Fonte />
            <div className="mac-vigencia">
              <p className="mac-rotulo">Vigência do dispositivo</p>
              <div className="regua"><i style={{ left: "0%" }} /><b style={{ left: "0%", width: "100%" }} /></div>
              <div className="regua-anos"><span>2026</span><span>2033</span></div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

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
                <div className="saf-field"><span className="addr">app.advfin.com.br</span></div>
              </div>
              <TelaMac />
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

/* ---------- iPhone Duo aberto: a simulação da transição ---------- */
function TelaDuo() {
  const maior = Math.max(...EXEMPLO.map((r) => Math.max(r.ano_.total, r.base.total)));
  const foco = EXEMPLO.find((r) => r.ano === ANO_EM_FOCO)!;
  const novo = (r: (typeof EXEMPLO)[number]) =>
    r.ano_.linhas.filter((l) => l.tributo === "CBS" || l.tributo === "IBS").reduce((s, l) => s + l.valor, 0) -
    (r.ano === 2026 ? r.destacadoCompensado : 0);
  const status = (t: string) => (t === "CBS" ? "estimativa" : t === "IBS" ? "norma" : "premissa");
  return (
    <div className="viewport app tela-duo">
      <div className="app-topo">
        <Marca />
        <span className="app-data">Simulação</span>
      </div>
      <div className="duo-corpo">
        <div>
          <p className="duo-rotulo">Serviços · regime padrão</p>
          <p className="duo-valor">{formatarReais(foco.ano_.total)}<small> em {ANO_EM_FOCO}</small></p>
          <p className="duo-dif">
            <span className={foco.diferenca < 0 ? "menos" : "mais"}>{formatarReais(foco.diferenca)}</span> em relação a hoje, sobre
            R$ 10.000,00
          </p>
        </div>
        <div className="duo-grafico">
          <div className="duo-area">
            {EXEMPLO.map((r) => (
              <div key={r.ano} className={`duo-barra${r.ano === ANO_EM_FOCO ? " foco" : ""}`} style={{ height: `${(r.ano_.total / maior) * 100}%` }}>
                <i className="novo" style={{ height: `${(novo(r) / r.ano_.total) * 100}%` }} />
              </div>
            ))}
            <i className="duo-hoje" style={{ bottom: `${(foco.base.total / maior) * 100}%` }} />
          </div>
          <div className="duo-anos">
            {EXEMPLO.map((r) => (
              <span key={r.ano} className={r.ano === ANO_EM_FOCO ? "foco" : undefined}>{r.ano}</span>
            ))}
          </div>
        </div>
        <div className="duo-legenda">
          <span><i className="novo" />CBS e IBS</span>
          <span><i />PIS/Cofins e ISS</span>
          <span><i className="linha" />Carga de hoje</span>
        </div>
        <div className="duo-linhas">
          {foco.ano_.linhas
            .filter((l) => l.valor > 0)
            .map((l) => (
              <div key={l.tributo}>
                <span>{l.tributo}</span>
                <span className="duo-aliq">{formatarPercentual(l.aliquota)}</span>
                <b>{formatarReais(l.valor)}</b>
                <span className={`selo ${status(l.tributo)}`}>{status(l.tributo)[0].toUpperCase() + status(l.tributo).slice(1)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function IPhoneDuo() {
  return (
    <div className="aparelho aparelho-duo" data-largura="665" aria-hidden="true">
      <div className="dev duo open">
        <i className="dz-btn dz-b1" /><i className="dz-btn dz-b2" /><i className="dz-btn dz-side" />
        <i className="dz-shade" />
        <div className="dz-band">
          <i className="dz-hinge" /><i className="dz-hm a" /><i className="dz-hm b" />
          <div className="dz-bezel">
            <div className="screen dz-screen">
              <StatusIOS classe="dz-status" />
              <TelaDuo />
              <div className="ios-home" />
              <i className="dz-crease" />
            </div>
            <i className="rim dz-rim" />
            <div className="glare" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- iPhone: a conversa ---------- */
function TelaIPhone() {
  return (
    <div className="viewport app tela-iphone">
      <div className="app-topo">
        <Marca />
        <span className="app-data">Vigência {DATA}</span>
      </div>
      <div className="app-conversa">
        <p className="bolha eu">Em 2026, a CBS destacada na nota é devida?</p>
        <div className="bolha ia">
          <p>
            Sim. Em 2026 a CBS é cobrada a 0,9% e o IBS a 0,1%, compensáveis com PIS/Cofins devidos.
            <sup className="cit">1</sup>
          </p>
          <Fonte compacta />
        </div>
      </div>
      <div className="app-campo">
        <span>Pergunte sobre a transição…</span>
        <span className="app-enviar">
          <svg viewBox="0 0 16 16"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>
      <nav className="app-abas">
        <span className="ativo"><Icone nome="pesquisa" />Pesquisa</span>
        <span><Icone nome="calculo" />Cálculo</span>
        <span><Icone nome="casos" />Casos</span>
      </nav>
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
                  <StatusIOS />
                  <TelaIPhone />
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
  const foco = EXEMPLO.find((r) => r.ano === ANO_EM_FOCO)!;
  return (
    <figure className="vitrine">
      <div className="vitrine-palco">
        <MacBook />
        <IPhoneDuo />
        <IPhone />
      </div>
      <EscalaAparelhos />
      <figcaption className="so-leitor">
        Exemplo do AdvFin em três telas. No computador, a pesquisa com a fonte ao lado: em 2026 a CBS é cobrada a
        0,9% e o IBS a 0,1%, compensáveis com PIS/Cofins, conforme o ADCT, art. 125, vigente em {DATA}. No iPhone Duo,
        a simulação de um serviço de R$ 10.000,00: em {ANO_EM_FOCO} a carga é de {formatarReais(foco.ano_.total)}. No
        iPhone, a mesma pergunta em forma de conversa.
      </figcaption>
      <p className="vitrine-nota" aria-hidden="true">Trechos e números ilustrativos. No produto, o texto vem da base oficial versionada.</p>
    </figure>
  );
}
