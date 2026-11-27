"use client";

import { useId, useMemo, useState } from "react";
import { Segmentado } from "@/components/Segmentado";
import { Cabeca } from "./Cabeca";
import { apurarTransicao, PREMISSAS_APURACAO } from "@/lib/tax/apuracao";
import { REFERENCIA_ESTIMADA, REGIMES, type Fonte, type Regime, type StatusFonte } from "@/lib/tax/cronograma";
import { calcular, linhaDoTempo } from "@/lib/tax/engine";
import { formatarPercentual, formatarReais, percentualParaPpm, reaisParaCentavos, type Ppm } from "@/lib/tax/money";
import { Seletor } from "@/components/ui/Seletor";

/** Nas tabelas a nota diz que os valores são em reais; sem o "R$" repetido, os números alinham e respiram. */
const emReais = (c: number) => formatarReais(c).replace(/R\$\s?/g, "");

type Aba = "tempo" | "comparador" | "apuracao";
const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];
const IDS_REGIME = Object.keys(REGIMES) as Regime[];
const STATUS: Record<StatusFonte, string> = { norma: "Norma", estimativa: "Estimativa", premissa: "Premissa" };

function ler<T>(f: () => T): T | null {
  try {
    return f();
  } catch {
    return null;
  }
}

const pct = (p: Ppm) => formatarPercentual(p).replace("%", "");

/** Campos compartilhados entre as abas: valores informados e alíquotas atuais. */
function useEntradas() {
  const [valor, setValor] = useState("100.000,00");
  const [tipo, setTipo] = useState<"mercadoria" | "servico">("servico");
  const [pisCofins, setPisCofins] = useState("9,25");
  const [icms, setIcms] = useState("18");
  const [iss, setIss] = useState("5");
  const [regime, setRegime] = useState<Regime>("padrao");
  const [refCbs, setRefCbs] = useState(pct(REFERENCIA_ESTIMADA.cbs));
  const [refIbs, setRefIbs] = useState(pct(REFERENCIA_ESTIMADA.ibs));
  const v = {
    valor: ler(() => reaisParaCentavos(valor)),
    pisCofins: ler(() => percentualParaPpm(pisCofins)),
    icms: tipo === "mercadoria" ? ler(() => percentualParaPpm(icms)) : 0,
    iss: tipo === "servico" ? ler(() => percentualParaPpm(iss)) : 0,
    refCbs: ler(() => percentualParaPpm(refCbs)),
    refIbs: ler(() => percentualParaPpm(refIbs)),
  };
  const estimativa = v.refCbs === REFERENCIA_ESTIMADA.cbs && v.refIbs === REFERENCIA_ESTIMADA.ibs;
  return {
    campos: { valor, setValor, tipo, setTipo, pisCofins, setPisCofins, icms, setIcms, iss, setIss, regime, setRegime, refCbs, setRefCbs, refIbs, setRefIbs },
    v,
    valido: Object.values(v).every((x) => x !== null),
    referencia: estimativa || v.refCbs === null || v.refIbs === null ? undefined : { cbs: v.refCbs, ibs: v.refIbs },
  };
}

function Campo({ id, rotulo, valor, muda, sufixo, invalido, ajuda }: { id: string; rotulo: string; valor: string; muda: (s: string) => void; sufixo?: string; invalido?: boolean; ajuda?: string }) {
  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo}
        {sufixo ? ` (${sufixo})` : ""}
      </label>
      <input id={id} inputMode="decimal" value={valor} onChange={(e) => muda(e.target.value)} aria-invalid={invalido || undefined} />
      {invalido ? <span className="erro">Valor inválido</span> : ajuda ? <span className="ajuda">{ajuda}</span> : null}
    </div>
  );
}

function Fontes({ fontes }: { fontes: Fonte[] }) {
  const unicas = [...new Map(fontes.map((f) => [f.rotulo, f])).values()];
  return (
    <ul className="fontes-calc">
      {unicas.map((f) => (
        <li key={f.rotulo}>
          <span className={`selo ${f.status}`}>{STATUS[f.status]}</span>
          <span>{f.rotulo}</span>
          {!f.conferido && <span className="selo em_revisao">a conferir</span>}
        </li>
      ))}
    </ul>
  );
}

function Referencia({ c, id }: { c: ReturnType<typeof useEntradas>["campos"]; id: string }) {
  return (
    <details className="campo">
      <summary className="nota-pequena" style={{ cursor: "pointer" }}>Alíquotas de referência (estimativa editável)</summary>
      <div className="duas-col">
        <Campo id={`${id}-rcbs`} rotulo="CBS" sufixo="%" valor={c.refCbs} muda={c.setRefCbs} />
        <Campo id={`${id}-ribs`} rotulo="IBS" sufixo="%" valor={c.refIbs} muda={c.setRefIbs} />
      </div>
    </details>
  );
}

/** Gráfico da transição, o mesmo da demonstração (iPhone Duo): barras por ano, CBS/IBS em marinho, linha da carga de hoje. */
function GraficoTransicao({ tempo, foco, muda }: { tempo: ReturnType<typeof linhaDoTempo>; foco: number; muda: (a: number) => void }) {
  if (!tempo.length) return null;
  const maior = Math.max(1, ...tempo.map((r) => Math.max(r.ano_.total, r.base.total)));
  const r0 = tempo.find((r) => r.ano === foco) ?? tempo[0];
  const novo = (r: (typeof tempo)[number]) =>
    r.ano_.linhas.filter((l) => l.tributo === "CBS" || l.tributo === "IBS").reduce((s, l) => s + l.valor, 0) - r.destacadoCompensado;
  return (
    <div className="duo-corpo mesa-grafico">
      <div>
        <p className="duo-rotulo">{REGIMES[r0.regime].rotulo}</p>
        <p className="duo-valor">
          {formatarReais(r0.ano_.total)}
          <small> em {r0.ano}</small>
        </p>
        <p className="duo-dif">
          <span className={r0.diferenca < 0 ? "menos" : "mais"}>{formatarReais(r0.diferenca)}</span> em relação a hoje ({formatarReais(r0.base.total)})
        </p>
      </div>
      <div className="duo-grafico">
        <div className="duo-area">
          {tempo.map((r) => (
            <button
              type="button"
              key={r.ano}
              className={`duo-barra${r.ano === foco ? " foco" : ""}`}
              style={{ height: `${(r.ano_.total / maior) * 100}%` }}
              onClick={() => muda(r.ano)}
              aria-label={`${r.ano}: ${formatarReais(r.ano_.total)}`}
              aria-pressed={r.ano === foco}
            >
              <i className="novo" style={{ height: `${r.ano_.total ? (Math.max(0, novo(r)) / r.ano_.total) * 100 : 0}%` }} />
            </button>
          ))}
          <i className="duo-hoje" style={{ bottom: `${(r0.base.total / maior) * 100}%` }} />
        </div>
        <div className="duo-anos">
          {tempo.map((r) => (
            <span key={r.ano} className={r.ano === foco ? "foco" : undefined}>{r.ano}</span>
          ))}
        </div>
      </div>
      <div className="duo-legenda">
        <span><i className="novo" />CBS e IBS</span>
        <span><i />PIS/Cofins, ICMS e ISS</span>
        <span><i className="linha" />Carga de hoje</span>
      </div>
    </div>
  );
}

export function Calculo({ trilha }: { trilha: string }) {
  const [anoFoco, setAnoFoco] = useState(2027);
  const id = useId();
  const [aba, setAba] = useState<Aba>("tempo");
  const e = useEntradas();
  const c = e.campos;

  // Apuração tem entradas próprias.
  const [vendas, setVendas] = useState("1.000.000,00");
  const [compras, setCompras] = useState("400.000,00");
  const [regVendas, setRegVendas] = useState<Regime>("padrao");
  const [regCompras, setRegCompras] = useState<Regime>("padrao");
  const vVendas = ler(() => reaisParaCentavos(vendas));
  const vCompras = ler(() => reaisParaCentavos(compras));

  const base = e.valido
    ? { valor: e.v.valor!, regime: c.regime, atual: { pisCofins: e.v.pisCofins!, icms: e.v.icms!, iss: e.v.iss! }, referencia: e.referencia }
    : null;

  const tempo = useMemo(() => (base ? linhaDoTempo(base) : []), [JSON.stringify(base)]); // eslint-disable-line react-hooks/exhaustive-deps
  const [anoComp, setAnoComp] = useState(2033);
  const comparacao = useMemo(
    () => (base ? IDS_REGIME.map((r) => calcular({ ...base, regime: r, ano: anoComp })) : []),
    [JSON.stringify(base), anoComp], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const apuracao = useMemo(
    () =>
      vVendas !== null && vCompras !== null
        ? apurarTransicao({ vendas: vVendas, comprasComCredito: vCompras, regimeVendas: regVendas, regimeCompras: regCompras, referencia: e.referencia })
        : [],
    [vVendas, vCompras, regVendas, regCompras, JSON.stringify(e.referencia)], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const seletorRegime = (valor: Regime, muda: (r: Regime) => void, rid: string, rotulo = "Regime de IBS/CBS") => (
    <div className="campo">
      <label htmlFor={rid}>{rotulo}</label>
      <Seletor id={rid} value={valor} onChange={(v) => muda(v as Regime)} opcoes={IDS_REGIME.map((r) => ({ valor: r, rotulo: REGIMES[r].rotulo }))} />
    </div>
  );

  const operacao = (
    <>
      <Campo id={`${id}-valor`} rotulo="Valor da operação, sem tributos" sufixo="R$" valor={c.valor} muda={c.setValor} invalido={e.v.valor === null} />
      <div className="campo">
        <span className="rotulo" id={`${id}-tipo`}>Tipo</span>
        <Segmentado
          rotulo="Tipo"
          idRotulo={`${id}-tipo`}
          cheio
          opcoes={[{ id: "mercadoria", nome: "Mercadoria" }, { id: "servico", nome: "Serviço" }]}
          valor={c.tipo}
          muda={c.setTipo}
        />
      </div>
      <div className="duas-col">
        <Campo id={`${id}-pis`} rotulo="PIS/Cofins" sufixo="%" valor={c.pisCofins} muda={c.setPisCofins} invalido={e.v.pisCofins === null} />
        {c.tipo === "mercadoria" ? (
          <Campo id={`${id}-icms`} rotulo="ICMS" sufixo="%" valor={c.icms} muda={c.setIcms} invalido={e.v.icms === null} />
        ) : (
          <Campo id={`${id}-iss`} rotulo="ISS" sufixo="%" valor={c.iss} muda={c.setIss} invalido={e.v.iss === null} />
        )}
      </div>
    </>
  );

  return (
    <>
      <Cabeca trilha={trilha} titulo="Cálculo da transição" descricao="Motor determinístico, em centavos exatos. Cada número diz se vem de norma, estimativa ou premissa.">
        <Segmentado
          rotulo="Ferramenta de cálculo"
          opcoes={[
            { id: "tempo", nome: "Linha do tempo" },
            { id: "comparador", nome: "Comparador de regimes" },
            { id: "apuracao", nome: "Apuração com créditos" },
          ]}
          valor={aba}
          muda={setAba}
        />
      </Cabeca>

      {aba === "tempo" && (
        <div className="ferramenta">
          <form className="mesa-cartao" onSubmit={(ev) => ev.preventDefault()}>
            {operacao}
            {seletorRegime(c.regime, c.setRegime, `${id}-reg`)}
            <Referencia c={c} id={id} />
          </form>
          <div className="mesa-coluna">
            <GraficoTransicao tempo={tempo} foco={anoFoco} muda={setAnoFoco} />
            <div className="tabela-envolve">
              <table className="tabela">
                <caption className="so-leitor">Carga por ano na transição</caption>
                <thead>
                  <tr>
                    <th>Ano</th><th>PIS/Cofins</th><th>ICMS/ISS</th><th>CBS</th><th>IBS</th><th>Total no ano</th><th>vs. hoje</th>
                  </tr>
                </thead>
                <tbody>
                  {tempo.map((r) => {
                    const v = (t: string) => r.ano_.linhas.filter((l) => t.split("|").includes(l.tributo)).reduce((s, l) => s + l.valor, 0);
                    return (
                      <tr key={r.ano} className={r.ano === anoFoco ? "em-foco" : undefined} onClick={() => setAnoFoco(r.ano)}>
                        <td>{r.ano}</td>
                        <td>{emReais(v("PIS/Cofins"))}</td>
                        <td>{emReais(v("ICMS|ISS"))}</td>
                        <td>{emReais(v("CBS"))}</td>
                        <td>{emReais(v("IBS"))}{r.destacadoCompensado ? " *" : ""}</td>
                        <td><strong>{emReais(r.ano_.total)}</strong></td>
                        <td className={r.diferenca < 0 ? "menor" : r.diferenca > 0 ? "maior" : ""}>
                          {r.diferenca > 0 ? "+" : ""}{emReais(r.diferenca)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {tempo[0] && (
              <p className="nota-pequena">
                Valores em R$. * Em 2026, CBS e IBS são destacados e compensados com o PIS/Cofins ({formatarReais(tempo[0].destacadoCompensado)}).
                Carga de hoje: {formatarReais(tempo[0].base.total)}.
              </p>
            )}
            {tempo.length > 0 && <Fontes fontes={tempo.flatMap((r) => r.fontes)} />}
          </div>
        </div>
      )}

      {aba === "comparador" && (
        <div className="ferramenta">
          <form className="mesa-cartao" onSubmit={(ev) => ev.preventDefault()}>
            {operacao}
            <div className="campo">
              <label htmlFor={`${id}-ano`}>Ano</label>
              <Seletor id={`${id}-ano`} value={String(anoComp)} onChange={(v) => setAnoComp(Number(v))} opcoes={ANOS.map((a) => ({ valor: String(a), rotulo: String(a) }))} />
            </div>
            <Referencia c={c} id={id} />
          </form>
          <div className="mesa-coluna">
            <div className="comparador">
              {comparacao.map((r) => {
                const cbs = r.ano_.linhas.find((l) => l.tributo === "CBS")!;
                const ibs = r.ano_.linhas.find((l) => l.tributo === "IBS")!;
                return (
                  <article key={r.regime} className="regime-cartao">
                    <h3>{REGIMES[r.regime].rotulo}</h3>
                    <span className="valor">{formatarReais(r.ano_.total)}</span>
                    <span className="aliq">
                      CBS {formatarPercentual(cbs.aliquota)} · IBS {formatarPercentual(ibs.aliquota)}
                    </span>
                    <span className={`aliq ${r.diferenca < 0 ? "menor" : ""}`}>
                      {r.diferenca > 0 ? "+" : ""}{formatarReais(r.diferenca)} frente à carga de hoje
                    </span>
                  </article>
                );
              })}
            </div>
            <p className="nota-pequena">
              Total do ano inclui o que ainda resta de PIS/Cofins, ICMS e ISS. O enquadramento em cada regime depende de requisitos
              da LC 214/2025: confira na classificação NCM/NBS.
            </p>
            {comparacao.length > 0 && <Fontes fontes={comparacao.flatMap((r) => r.fontes)} />}
          </div>
        </div>
      )}

      {aba === "apuracao" && (
        <div className="ferramenta">
          <form className="mesa-cartao" onSubmit={(ev) => ev.preventDefault()}>
            <Campo id={`${id}-vendas`} rotulo="Vendas no ano, sem tributos" sufixo="R$" valor={vendas} muda={setVendas} invalido={vVendas === null} />
            {seletorRegime(regVendas, setRegVendas, `${id}-rv`, "Regime das vendas")}
            <Campo id={`${id}-compras`} rotulo="Compras com direito a crédito" sufixo="R$" valor={compras} muda={setCompras} invalido={vCompras === null} ajuda="Insumos, mercadorias e serviços tomados." />
            {seletorRegime(regCompras, setRegCompras, `${id}-rc`, "Regime das compras")}
            <Referencia c={c} id={id} />
          </form>
          <div className="mesa-coluna">
            <div className="tabela-envolve">
              <table className="tabela">
                <caption className="so-leitor">Apuração de CBS e IBS por ano</caption>
                <thead>
                  <tr>
                    <th>Ano</th><th>Débito CBS</th><th>Crédito CBS</th><th>Débito IBS</th><th>Crédito IBS</th><th>A recolher</th><th>Saldo credor</th>
                  </tr>
                </thead>
                <tbody>
                  {apuracao.map((a) => (
                    <tr key={a.ano}>
                      <td>{a.ano}{a.compensavelComPisCofins ? " *" : ""}</td>
                      <td>{emReais(a.debito.cbs)}</td>
                      <td>{emReais(a.credito.cbs)}</td>
                      <td>{emReais(a.debito.ibs)}</td>
                      <td>{emReais(a.credito.ibs)}</td>
                      <td><strong>{emReais(a.devido.total)}</strong></td>
                      <td>{emReais(a.saldoCredor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="nota-pequena">Valores em R$. * Em 2026 o valor apurado é compensável com PIS/Cofins: não é carga adicional.</p>
            <ul className="premissas">
              {PREMISSAS_APURACAO.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
