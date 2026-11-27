"use client";

import { useId, useMemo, useState } from "react";
import { calcular, linhaDoTempo, type ResultadoCalculo } from "@/lib/tax/engine";
import { REFERENCIA_ESTIMADA, REGIMES, type Regime, type StatusFonte } from "@/lib/tax/cronograma";
import { Segmentado } from "./Segmentado";
import { formatarPercentual, formatarReais, percentualParaPpm, reaisParaCentavos } from "@/lib/tax/money";
import { Seletor } from "@/components/ui/Seletor";

const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];
const ROTULO_STATUS: Record<StatusFonte, string> = { norma: "Norma", estimativa: "Estimativa", premissa: "Premissa" };

type Tipo = "mercadoria" | "servico";

function ler<T>(f: () => T): T | null {
  try {
    return f();
  } catch {
    return null;
  }
}

export function Calculadora() {
  const id = useId();
  const [valor, setValor] = useState("10.000,00");
  const [ano, setAno] = useState(2027);
  const [tipo, setTipo] = useState<Tipo>("mercadoria");
  const [regime, setRegime] = useState<Regime>("padrao");
  const [pisCofins, setPisCofins] = useState("9,25");
  const [icms, setIcms] = useState("18");
  const [iss, setIss] = useState("5");
  const [refCbs, setRefCbs] = useState(formatarPercentual(REFERENCIA_ESTIMADA.cbs).replace("%", ""));
  const [refIbs, setRefIbs] = useState(formatarPercentual(REFERENCIA_ESTIMADA.ibs).replace("%", ""));

  const entradas = {
    valor: ler(() => reaisParaCentavos(valor)),
    pisCofins: ler(() => percentualParaPpm(pisCofins)),
    icms: tipo === "mercadoria" ? ler(() => percentualParaPpm(icms)) : 0,
    iss: tipo === "servico" ? ler(() => percentualParaPpm(iss)) : 0,
    refCbs: ler(() => percentualParaPpm(refCbs)),
    refIbs: ler(() => percentualParaPpm(refIbs)),
  };
  const valido = Object.values(entradas).every((v) => v !== null);

  const { resultado, tempo } = useMemo(() => {
    if (!valido) return { resultado: null, tempo: [] as ResultadoCalculo[] };
    const usaEstimativa = entradas.refCbs === REFERENCIA_ESTIMADA.cbs && entradas.refIbs === REFERENCIA_ESTIMADA.ibs;
    const base = {
      valor: entradas.valor!,
      regime,
      atual: { pisCofins: entradas.pisCofins!, icms: entradas.icms!, iss: entradas.iss! },
      referencia: usaEstimativa ? undefined : { cbs: entradas.refCbs!, ibs: entradas.refIbs! },
    };
    return { resultado: calcular({ ...base, ano }), tempo: linhaDoTempo(base) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valido, ano, regime, ...Object.values(entradas)]);

  const maxTempo = Math.max(1, ...tempo.map((r) => r.ano_.total), resultado?.base.total ?? 0);

  return (
    <div className="calc">
      <form className="painel" onSubmit={(e) => e.preventDefault()} aria-describedby={`${id}-aviso`}>
        <div className="campo">
          <label htmlFor={`${id}-valor`}>Valor da operação (sem tributos)</label>
          <input
            id={`${id}-valor`}
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-invalid={entradas.valor === null}
          />
          {entradas.valor === null && <span className="erro">Informe um valor como 10.000,00</span>}
        </div>

        <div className="campo">
          <span className="rotulo" id={`${id}-tipo`}>Tipo de operação</span>
          <Segmentado
            rotulo="Tipo de operação"
            idRotulo={`${id}-tipo`}
            cheio
            valor={tipo}
            muda={setTipo}
            opcoes={[
              { id: "mercadoria", nome: "Mercadoria (ICMS)" },
              { id: "servico", nome: "Serviço (ISS)" },
            ]}
          />
        </div>

        <div className="campo">
          <span className="rotulo" id={`${id}-ano`}>Ano</span>
          <Segmentado
            rotulo="Ano"
            idRotulo={`${id}-ano`}
            cheio
            valor={ano}
            muda={setAno}
            opcoes={ANOS.map((a) => ({ id: a, nome: a }))}
          />
        </div>

        <div className="dupla">
          <div className="campo">
            <label htmlFor={`${id}-pis`}>PIS/Cofins atual (%)</label>
            <input
              id={`${id}-pis`}
              type="text"
              inputMode="decimal"
              value={pisCofins}
              onChange={(e) => setPisCofins(e.target.value)}
              aria-invalid={entradas.pisCofins === null}
            />
          </div>
        <div className="campo">
          {tipo === "mercadoria" ? (
            <>
              <label htmlFor={`${id}-icms`}>ICMS atual (%)</label>
              <input id={`${id}-icms`} type="text" inputMode="decimal" value={icms} onChange={(e) => setIcms(e.target.value)} aria-invalid={entradas.icms === null} />
            </>
          ) : (
            <>
              <label htmlFor={`${id}-iss`}>ISS atual (%)</label>
              <input id={`${id}-iss`} type="text" inputMode="decimal" value={iss} onChange={(e) => setIss(e.target.value)} aria-invalid={entradas.iss === null} />
            </>
          )}
        </div>
        </div>

        <div className="campo">
          <label htmlFor={`${id}-regime`}>Regime de IBS/CBS</label>
          <Seletor
            id={`${id}-regime`}
            value={regime}
            onChange={(v) => setRegime(v as Regime)}
            opcoes={Object.entries(REGIMES).map(([k, r]) => ({ valor: k, rotulo: r.rotulo }))}
          />
          <span className="ajuda">A classificação por NCM/NBS chega no copiloto da Reforma.</span>
        </div>

        <details>
          <summary>Alíquotas de referência (estimativa)</summary>
          <div className="dupla">
            <div className="campo">
              <label htmlFor={`${id}-rcbs`}>CBS (%)</label>
              <input id={`${id}-rcbs`} type="text" inputMode="decimal" value={refCbs} onChange={(e) => setRefCbs(e.target.value)} aria-invalid={entradas.refCbs === null} />
            </div>
            <div className="campo">
              <label htmlFor={`${id}-ribs`}>IBS (%)</label>
              <input id={`${id}-ribs`} type="text" inputMode="decimal" value={refIbs} onChange={(e) => setRefIbs(e.target.value)} aria-invalid={entradas.refIbs === null} />
            </div>
          </div>
        </details>
        <p id={`${id}-aviso`} className="nota-pequena">
          Cálculo determinístico, feito no seu navegador. Nenhum dado é enviado.
        </p>
      </form>

      <div className="resultado" aria-live="polite">
        {!resultado ? (
          <p className="erro">Revise os campos destacados para ver o cálculo.</p>
        ) : (
          <>
            <h3>Em {resultado.ano}, sobre {formatarReais(entradas.valor!)}</h3>
            <dl className="destaque">
              <div>
                <dt>Regime atual (antes da Reforma)</dt>
                <dd>{formatarReais(resultado.base.total)}</dd>
              </div>
              <div>
                <dt>Carga em {resultado.ano}</dt>
                <dd>{formatarReais(resultado.ano_.total)}</dd>
              </div>
              <div>
                <dt>Diferença</dt>
                <dd className={resultado.diferenca < 0 ? "menos" : resultado.diferenca > 0 ? "mais" : ""}>
                  {resultado.diferenca > 0 ? "+ " : resultado.diferenca < 0 ? "− " : ""}
                  {formatarReais(Math.abs(resultado.diferenca))}
                </dd>
              </div>
            </dl>

            <table>
              <caption>Tributos em {resultado.ano}</caption>
              <thead>
                <tr>
                  <th scope="col">Tributo</th>
                  <th scope="col">Alíquota</th>
                  <th scope="col">Valor</th>
                </tr>
              </thead>
              <tbody>
                {resultado.ano_.linhas
                  .filter((l) => l.aliquota > 0 || l.tributo === "CBS" || l.tributo === "IBS")
                  .map((l) => (
                    <tr key={l.tributo}>
                      <th scope="row">{l.tributo}</th>
                      <td>{formatarPercentual(l.aliquota)}</td>
                      <td>{formatarReais(l.valor)}</td>
                    </tr>
                  ))}
                {resultado.destacadoCompensado > 0 && (
                  <tr>
                    <th scope="row">CBS/IBS compensados com PIS/Cofins</th>
                    <td>—</td>
                    <td>−{formatarReais(resultado.destacadoCompensado)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td />
                  <td>{formatarReais(resultado.ano_.total)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="tempo" role="img" aria-label={`Carga por ano, de 2026 a 2033: ${tempo.map((r) => `${r.ano}, ${formatarReais(r.ano_.total)}`).join("; ")}`}>
              {tempo.map((r) => (
                <div key={r.ano} className={`tempo-barra${r.ano === ano ? " atual" : ""}`}>
                  {(() => {
                    const novos = r.ano_.linhas
                      .filter((l) => l.tributo === "CBS" || l.tributo === "IBS")
                      .reduce((s, l) => s + l.valor, 0) - r.destacadoCompensado;
                    const antigos = r.ano_.total - novos;
                    return (
                      <>
                        <div className="novo" style={{ height: `${(novos / maxTempo) * 100}%` }} />
                        <div style={{ height: `${(antigos / maxTempo) * 100}%` }} />
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
            <div className="tempo-rotulos" aria-hidden="true">
              {tempo.map((r) => (
                <span key={r.ano}>{r.ano}</span>
              ))}
            </div>
            <p className="legenda" aria-hidden="true">
              <span><i className="q antigo" /> PIS/Cofins, ICMS e ISS</span>
              <span><i className="q novo" /> CBS e IBS</span>
              <span>Ano selecionado em destaque</span>
            </p>

            <h3 className="titulo-fontes">Fontes e premissas deste cálculo</h3>
            <ul className="fontes">
              {resultado.fontes.map((f, i) => (
                <li key={i}>
                  <span className={`selo ${f.status}`}>{ROTULO_STATUS[f.status]}</span>
                  <span>
                    {f.rotulo}
                    {f.status === "norma" && !f.conferido && " · dispositivo em conferência pelo curador"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
