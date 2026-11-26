"use client";

import { useId, useMemo, useState } from "react";
import { Segmentado } from "@/components/Segmentado";
import { apurarTransicao, PREMISSAS_APURACAO } from "@/lib/tax/apuracao";
import { REFERENCIA_ESTIMADA, REGIMES, type Fonte, type Regime, type StatusFonte } from "@/lib/tax/cronograma";
import { calcular, linhaDoTempo } from "@/lib/tax/engine";
import { formatarPercentual, formatarReais, percentualParaPpm, reaisParaCentavos, type Ppm } from "@/lib/tax/money";

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
          {f.rotulo}
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
      <div className="duas-col" style={{ marginTop: 12 }}>
        <Campo id={`${id}-rcbs`} rotulo="CBS" sufixo="%" valor={c.refCbs} muda={c.setRefCbs} />
        <Campo id={`${id}-ribs`} rotulo="IBS" sufixo="%" valor={c.refIbs} muda={c.setRefIbs} />
      </div>
    </details>
  );
}

export function Calculo() {
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
      <select id={rid} value={valor} onChange={(ev) => muda(ev.target.value as Regime)}>
        {IDS_REGIME.map((r) => (
          <option key={r} value={r}>{REGIMES[r].rotulo}</option>
        ))}
      </select>
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
      <div className="abas">
        <Segmentado
          rotulo="Ferramenta de cálculo"
          cheio
          opcoes={[
            { id: "tempo", nome: "Linha do tempo" },
            { id: "comparador", nome: "Comparador de regimes" },
            { id: "apuracao", nome: "Apuração com créditos" },
          ]}
          valor={aba}
          muda={setAba}
        />
      </div>

      {aba === "tempo" && (
        <div className="ferramenta">
          <form className="painel" onSubmit={(ev) => ev.preventDefault()}>
            {operacao}
            {seletorRegime(c.regime, c.setRegime, `${id}-reg`)}
            <Referencia c={c} id={id} />
          </form>
          <div>
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
                      <tr key={r.ano}>
                        <td>{r.ano}</td>
                        <td>{formatarReais(v("PIS/Cofins"))}</td>
                        <td>{formatarReais(v("ICMS|ISS"))}</td>
                        <td>{formatarReais(v("CBS"))}</td>
                        <td>{formatarReais(v("IBS"))}{r.destacadoCompensado ? " *" : ""}</td>
                        <td><strong>{formatarReais(r.ano_.total)}</strong></td>
                        <td className={r.diferenca < 0 ? "menor" : r.diferenca > 0 ? "maior" : ""}>
                          {r.diferenca > 0 ? "+" : ""}{formatarReais(r.diferenca)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {tempo[0] && (
              <p className="nota-pequena" style={{ marginTop: 10 }}>
                * Em 2026, CBS e IBS são destacados e compensados com o PIS/Cofins ({formatarReais(tempo[0].destacadoCompensado)}).
                Carga de hoje: {formatarReais(tempo[0].base.total)}.
              </p>
            )}
            {tempo.length > 0 && <Fontes fontes={tempo.flatMap((r) => r.fontes)} />}
          </div>
        </div>
      )}

      {aba === "comparador" && (
        <div className="ferramenta">
          <form className="painel" onSubmit={(ev) => ev.preventDefault()}>
            {operacao}
            <div className="campo">
              <label htmlFor={`${id}-ano`}>Ano</label>
              <select id={`${id}-ano`} value={anoComp} onChange={(ev) => setAnoComp(Number(ev.target.value))}>
                {ANOS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <Referencia c={c} id={id} />
          </form>
          <div>
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
            <p className="nota-pequena" style={{ marginTop: 12 }}>
              Total do ano inclui o que ainda resta de PIS/Cofins, ICMS e ISS. O enquadramento em cada regime depende de requisitos
              da LC 214/2025: confira na classificação NCM/NBS.
            </p>
            {comparacao.length > 0 && <Fontes fontes={comparacao.flatMap((r) => r.fontes)} />}
          </div>
        </div>
      )}

      {aba === "apuracao" && (
        <div className="ferramenta">
          <form className="painel" onSubmit={(ev) => ev.preventDefault()}>
            <Campo id={`${id}-vendas`} rotulo="Vendas no ano, sem tributos" sufixo="R$" valor={vendas} muda={setVendas} invalido={vVendas === null} />
            {seletorRegime(regVendas, setRegVendas, `${id}-rv`, "Regime das vendas")}
            <Campo id={`${id}-compras`} rotulo="Compras com direito a crédito" sufixo="R$" valor={compras} muda={setCompras} invalido={vCompras === null} ajuda="Insumos, mercadorias e serviços tomados." />
            {seletorRegime(regCompras, setRegCompras, `${id}-rc`, "Regime das compras")}
            <Referencia c={c} id={id} />
          </form>
          <div>
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
                      <td>{formatarReais(a.debito.cbs)}</td>
                      <td>{formatarReais(a.credito.cbs)}</td>
                      <td>{formatarReais(a.debito.ibs)}</td>
                      <td>{formatarReais(a.credito.ibs)}</td>
                      <td><strong>{formatarReais(a.devido.total)}</strong></td>
                      <td>{formatarReais(a.saldoCredor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="nota-pequena" style={{ marginTop: 10 }}>* Em 2026 o valor apurado é compensável com PIS/Cofins: não é carga adicional.</p>
            <ul className="premissas">
              {PREMISSAS_APURACAO.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
