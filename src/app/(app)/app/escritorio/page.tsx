import Link from "next/link";
import { notFound } from "next/navigation";
import { Abas } from "@/components/app/Abas";
import { Cabeca } from "@/components/app/Cabeca";
import { FormAcao } from "@/components/app/FormAcao";
import { Convidar } from "@/components/app/escritorio/Convidar";
import { Pessoa, type PessoaLinha } from "@/components/app/escritorio/Pessoa";
import { SeletorImagem } from "@/components/app/perfil/Foto";
import { ROTULO_NIVEL, niveisConcedidos, type Nivel } from "@/lib/auth/niveis";
import { exigirSessao } from "@/lib/auth/sessao";
import { noEscritorio } from "@/lib/db";
import {
  abrirPortal, assinar, cancelarConvite, decidirEntrada, encerrarEscritorio, liberarConvite, reabrirEscritorio, reenviarConvite, salvarConfiguracoes,
  salvarLogo, transferirTitularidade,
} from "@/lib/escritorio/acoes";
import { ROTULO_ACAO, limiteMensal } from "@/lib/escritorio/rotulos";
import { formatarReais } from "@/lib/tax/money";
import { PLANOS, ROTULO_PLANO, listarFaturas, precoDoPlano, stripeConfigurado } from "@/lib/stripe";

export const metadata = { title: "Escritório — AdvFin" };

const quando = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—";
const dia = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const mes = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
/** custo em milionésimos de real → reais. */
const reais = (micro: number | string) => formatarReais(Math.round(Number(micro) / 10_000));

type Busca = { aba?: string; pessoa?: string; acao?: string; de?: string; ate?: string; ok?: string };

export default async function Escritorio({ searchParams }: { searchParams: Promise<Busca> }) {
  const s = await exigirSessao();
  if (!s.pode.has("gerir_pessoas") && !s.pode.has("configurar_escritorio")) notFound();
  const busca = await searchParams;
  const titular = s.pode.has("gerir_cobranca");

  const abas = [
    { id: "pessoas", nome: "Pessoas" },
    { id: "convites", nome: "Convites" },
    { id: "auditoria", nome: "Auditoria" },
    { id: "consumo", nome: "Consumo" },
    { id: "configuracoes", nome: "Configurações" },
    ...(titular ? [{ id: "plano", nome: "Plano e cobrança" }, { id: "dados", nome: "Dados e encerramento" }] : []),
  ];
  const aba = abas.some((a) => a.id === busca.aba) ? busca.aba! : "pessoas";

  const d = await noEscritorio(s, async (c) => {
    const q = async (sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows;
    const pessoas: PessoaLinha[] = await q(`select * from app.pessoas()`);
    const convites = ["pessoas", "convites", "plano"].includes(aba)
      ? await q(`select id, email, nivel, cargo, criado_em, expira_em, aguarda_titular, aceito_em, cancelado_em, convidado_por from convites order by criado_em desc limit 60`)
      : [];
    const pedidos = aba === "pessoas" ? await q(`select * from app.pedidos_pendentes()`) : [];
    const esc = (await q(`select nome, plano, logo_url, dominio_email, exige_2fa, sessao_horas, encerrado_em from escritorios where id = $1`, [s.escritorioId]))[0];
    let auditoria: any[] = [];
    if (aba === "auditoria") {
      auditoria = await q(
        `select id, usuario_id, acao, alvo_id, detalhes, criado_em from auditoria
         where ($1::uuid is null or usuario_id = $1) and ($2::text is null or acao = $2)
           and ($3::date is null or criado_em >= $3::date) and ($4::date is null or criado_em < $4::date + 1)
         order by id desc limit 200`,
        [busca.pessoa || null, busca.acao || null, busca.de || null, busca.ate || null],
      );
    }
    const consumo = aba === "consumo" ? await q(`select * from app.consumo(6)`) : [];
    const cobranca = titular && ["plano", "convites"].includes(aba) ? (await q(`select * from app.cobranca()`))[0] : null;
    const ids = [...new Set([...auditoria.map((a) => a.usuario_id), ...convites.map((x) => x.convidado_por)].filter(Boolean))];
    const nomes = new Map<string, string>(ids.length ? (await q(`select * from app.autores($1)`, [ids])).map((x) => [x.usuario_id, x.nome]) : []);
    return { pessoas, convites, pedidos, esc, auditoria, consumo, cobranca, nomes };
  });

  const pendentes = d.convites.filter((x) => !x.aceito_em && !x.cancelado_em && new Date(x.expira_em) > new Date());
  const ativos = d.pessoas.filter((p) => !p.suspenso_em);

  return (
    <>
      <Cabeca trilha={`${s.escritorio} / Escritório`} titulo="Administração do escritório" descricao={`${ativos.length} ${ativos.length === 1 ? "pessoa ativa" : "pessoas ativas"} · plano ${ROTULO_PLANO[d.esc.plano] ?? d.esc.plano}`}>
        <Abas base="/app/escritorio" abas={abas.map((a) => (a.id === "pessoas" ? { ...a, conta: d.pedidos.length || undefined } : a))} atual={aba} rotulo="Seções da administração" />
      </Cabeca>

      {aba === "pessoas" && (
        <div className="mesa-coluna">
          {(pendentes.length > 0 || d.pedidos.length > 0) && (
            <section className="bloco">
              <p className="mesa-rotulo">Aguardando</p>
              <ul className="mesa-pessoas">
                {d.pedidos.map((p: any) => (
                  <li key={p.id} className="mesa-pessoa">
                    <span className="mesa-pessoa-quem">
                      <span>
                        <strong>{p.nome}</strong>
                        <small>{p.email} · pediu para entrar pelo domínio em {dia(p.criado_em)}</small>
                      </span>
                    </span>
                    <span />
                    <span />
                    <div className="mesa-pessoa-acoes">
                      <FormAcao acao={decidirEntrada} botao="Aprovar" classe="">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="aprovar" value="1" />
                        <div className="campo">
                          <label htmlFor={`pedido-nivel-${p.id}`}>Entra como</label>
                          <select id={`pedido-nivel-${p.id}`} name="nivel" defaultValue="supervisionado">
                            {niveisConcedidos(s.nivel).map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
                          </select>
                        </div>
                        <div className="campo">
                          <label htmlFor={`pedido-cargo-${p.id}`}>Cargo</label>
                          <input id={`pedido-cargo-${p.id}`} name="cargo" maxLength={80} />
                        </div>
                      </FormAcao>
                      <FormAcao acao={decidirEntrada} botao="Recusar" classe="" secundario>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="aprovar" value="0" />
                        <p className="mesa-nota">A conta continua existindo, sem acesso ao escritório.</p>
                      </FormAcao>
                    </div>
                  </li>
                ))}
                {pendentes.map((x: any) => (
                  <li key={x.id} className="mesa-pessoa">
                    <span className="mesa-pessoa-quem">
                      <span>
                        <strong>{x.email}</strong>
                        <small>
                          Convite {x.aguarda_titular ? "aguardando o Titular liberar um assento" : `até ${dia(x.expira_em)}`}
                          {x.cargo ? ` · ${x.cargo}` : ""}
                        </small>
                      </span>
                    </span>
                    <span className="mesa-pessoa-info">
                      <span className={`selo nivel-${x.nivel}`}>{ROTULO_NIVEL[x.nivel as Nivel]}</span>
                    </span>
                    <span className="mesa-acoes">
                      {!x.aguarda_titular && (
                        <FormAcao acao={reenviarConvite} botao="Reenviar" pendente="Reenviando…" classe="mesa-form-linha" secundario>
                          <input type="hidden" name="id" value={x.id} />
                        </FormAcao>
                      )}
                      <form action={cancelarConvite}>
                        <input type="hidden" name="id" value={x.id} />
                        <button className="mesa-botao secundario">Cancelar</button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="bloco">
            <div className="mesa-topo" style={{ alignItems: "center" }}>
              <p className="mesa-rotulo">Pessoas</p>
              <Link className="mesa-botao" href="/app/escritorio?aba=convites">Convidar</Link>
            </div>
            <ul className="mesa-pessoas">
              {d.pessoas.map((p) => (
                <Pessoa key={p.usuario_id} p={p} eu={s.nivel} euId={s.usuarioId} />
              ))}
            </ul>
            <p className="mesa-nota">
              Ninguém muda o próprio nível. Um Administrador não promove ninguém acima de si nem age sobre outro Administrador; o
              Titular só muda por transferência.
            </p>
          </section>
        </div>
      )}

      {aba === "convites" && (
        <div className="mesa-grade-2">
          <Convidar
            eu={s.nivel}
            titular={titular}
            valorAssento={null}
          />
          <div className="mesa-coluna">
            <div className="mesa-cartao">
              <h2>Domínio do escritório</h2>
              {d.esc.dominio_email ? (
                <p>
                  Quem se cadastrar com um e-mail <strong>@{d.esc.dominio_email}</strong> pode pedir para entrar, e um Administrador aprova
                  em Pessoas.
                </p>
              ) : (
                <p>Sem domínio configurado. Com ele, quem se cadastra com o e-mail do escritório pede para entrar sem precisar de convite.</p>
              )}
              <div className="mesa-form-pe" style={{ justifyContent: "flex-start" }}>
                <Link className="mesa-botao secundario" href="/app/escritorio?aba=configuracoes">Configurar domínio</Link>
              </div>
            </div>
            <section className="bloco">
              <p className="mesa-rotulo">Últimos convites</p>
              {d.convites.length === 0 ? (
                <p className="mesa-vazio-cartao">Nenhum convite ainda.</p>
              ) : (
                <ul className="mesa-lista">
                  {d.convites.slice(0, 20).map((x: any) => (
                    <li key={x.id}>
                      <span>
                        {x.email} · {ROTULO_NIVEL[x.nivel as Nivel]}
                      </span>
                      <span>
                        {x.aceito_em ? `aceito em ${dia(x.aceito_em)}` : x.cancelado_em ? "cancelado" : new Date(x.expira_em) < new Date() ? "vencido" : x.aguarda_titular ? "aguarda o Titular" : `pendente até ${dia(x.expira_em)}`}
                        {" · por "}
                        {d.nomes.get(x.convidado_por) ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {aba === "auditoria" && (
        <div className="mesa-coluna">
          <form className="mesa-filtros" method="get">
            <input type="hidden" name="aba" value="auditoria" />
            <div className="campo">
              <label htmlFor="f-pessoa">Pessoa</label>
              <select id="f-pessoa" name="pessoa" defaultValue={busca.pessoa ?? ""}>
                <option value="">Todas</option>
                {d.pessoas.map((p) => <option key={p.usuario_id} value={p.usuario_id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="f-acao">Ação</label>
              <select id="f-acao" name="acao" defaultValue={busca.acao ?? ""}>
                <option value="">Todas</option>
                {Object.entries(ROTULO_ACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="f-de">De</label>
              <input id="f-de" type="date" name="de" defaultValue={busca.de} />
            </div>
            <div className="campo">
              <label htmlFor="f-ate">Até</label>
              <input id="f-ate" type="date" name="ate" defaultValue={busca.ate} />
            </div>
            <button className="mesa-botao">Filtrar</button>
            <a
              className="mesa-botao secundario"
              href={`/app/escritorio/auditoria.csv?${new URLSearchParams(Object.entries({ pessoa: busca.pessoa ?? "", acao: busca.acao ?? "", de: busca.de ?? "", ate: busca.ate ?? "" }).filter(([, v]) => v))}`}
            >
              Exportar CSV
            </a>
          </form>
          {d.auditoria.length === 0 ? (
            <p className="mesa-vazio-cartao">Nada registrado com esses filtros.</p>
          ) : (
            <div className="tabela-envolve">
              <table className="tabela">
                <thead>
                  <tr><th>Quando</th><th className="esq">Quem</th><th className="esq">O quê</th><th className="esq">Detalhe</th></tr>
                </thead>
                <tbody>
                  {d.auditoria.map((a: any) => (
                    <tr key={a.id}>
                      <td>{quando(a.criado_em)}</td>
                      <td className="esq">{a.usuario_id ? (d.nomes.get(a.usuario_id) ?? "—") : "Sistema"}</td>
                      <td className="esq">{ROTULO_ACAO[a.acao] ?? a.acao}</td>
                      <td className="esq"><small>{detalhe(a)}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mesa-nota">
            A trilha mostra o que foi feito e por quem, nunca o texto das consultas. Mostra as 200 linhas mais recentes; o CSV traz
            todas as do filtro.
          </p>
        </div>
      )}

      {aba === "consumo" && <Consumo linhas={d.consumo} plano={d.esc.plano} />}

      {aba === "configuracoes" && (
        <div className="mesa-grade-2">
          <FormAcao acao={salvarConfiguracoes} botao="Salvar configurações">
            <h2>Configurações</h2>
            <div className="campo">
              <label htmlFor="cfg-nome">Nome do escritório</label>
              <input id="cfg-nome" name="nome" defaultValue={d.esc.nome} required maxLength={160} />
            </div>
            <fieldset className="mesa-escolhas">
              <legend>Verificação em duas etapas</legend>
              {[
                ["nao", "Opcional", "Cada pessoa decide."],
                ["admins", "Obrigatória para Administradores e Titular", "Quem gere pessoas e dados precisa ativar antes de continuar."],
                ["todos", "Obrigatória para todos", "Ninguém entra sem o código do aplicativo."],
              ].map(([v, t, sub]) => (
                <label key={v} className="mesa-escolha">
                  <input type="radio" name="exige_2fa" value={v} defaultChecked={d.esc.exige_2fa === v} />
                  <span>{t}<small>{sub}</small></span>
                </label>
              ))}
            </fieldset>
            <div className="duas-col">
              <div className="campo">
                <label htmlFor="cfg-sessao">Tempo da sessão</label>
                <select id="cfg-sessao" name="sessao_horas" defaultValue={String(d.esc.sessao_horas)}>
                  {[[8, "8 horas"], [24, "1 dia"], [72, "3 dias"], [168, "7 dias"], [336, "14 dias"], [720, "30 dias"]].map(([h, t]) => (
                    <option key={h} value={h}>{t}</option>
                  ))}
                </select>
                <span className="ajuda">Vale para os próximos logins.</span>
              </div>
              <div className="campo">
                <label htmlFor="cfg-dominio">Domínio de e-mail</label>
                <input id="cfg-dominio" name="dominio_email" defaultValue={d.esc.dominio_email ?? ""} placeholder={s.email.split("@")[1]} />
                <span className="ajuda">Precisa ser o do seu próprio e-mail.</span>
              </div>
            </div>
          </FormAcao>
          <div className="mesa-cartao">
            <h2>Logo</h2>
            <p>Vai no cabeçalho do parecer exportado.</p>
            <SeletorImagem atual={d.esc.logo_url} nome={d.esc.nome} salvar={salvarLogo} quadrada={false} lado={480} rotulo="logo" />
          </div>
        </div>
      )}

      {aba === "plano" && titular && <Plano cobranca={d.cobranca} plano={d.esc.plano} convites={d.convites.filter((x: any) => x.aguarda_titular && !x.cancelado_em && !x.aceito_em)} ok={busca.ok === "1"} />}

      {aba === "dados" && titular && (
        <div className="mesa-grade-2">
          <div className="mesa-coluna">
            <div className="mesa-cartao">
              <h2>Exportar tudo</h2>
              <p>Casos, consultas, simulações, documentos, pessoas, convites e a auditoria inteira. A exportação fica registrada.</p>
              <div className="mesa-acoes">
                <a className="primaria" href="/app/escritorio/exportar?formato=json" download>JSON completo</a>
                {["consultas", "casos", "simulacoes", "membros", "auditoria"].map((t) => (
                  <a key={t} href={`/app/escritorio/exportar?formato=csv&tabela=${t}`} download>CSV de {t}</a>
                ))}
              </div>
            </div>
            <FormAcao acao={transferirTitularidade} botao="Transferir titularidade" pendente="Transferindo…" perigo>
              <h2>Transferir a titularidade</h2>
              <p>A pessoa escolhida vira Titular, e você passa a Administrador. Plano, cobrança e encerramento passam a ser dela.</p>
              <div className="campo">
                <label htmlFor="novo-titular">Novo Titular</label>
                <select id="novo-titular" name="usuario" required defaultValue="">
                  <option value="" disabled>Escolha</option>
                  {ativos.filter((p) => p.usuario_id !== s.usuarioId).map((p) => (
                    <option key={p.usuario_id} value={p.usuario_id}>{p.nome} ({ROTULO_NIVEL[p.nivel]})</option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="senha-transferir">Sua senha</label>
                <input id="senha-transferir" name="senha" type="password" autoComplete="current-password" required />
              </div>
            </FormAcao>
          </div>
          {d.esc.encerrado_em ? (
            <div className="mesa-cartao">
              <h2>Conta encerrada</h2>
              <p>
                Encerrada em {dia(d.esc.encerrado_em)}. Os dados são apagados em {dia(new Date(new Date(d.esc.encerrado_em).getTime() + 30 * 86_400_000))}.
                Até lá, só você entra.
              </p>
              <form action={reabrirEscritorio} className="mesa-form-pe">
                <button className="mesa-botao">Reabrir a conta</button>
              </form>
            </div>
          ) : (
            <FormAcao acao={encerrarEscritorio} botao="Encerrar a conta do escritório" pendente="Encerrando…" perigo>
              <h2>Encerrar a conta</h2>
              <p>
                Todos saem na hora, menos você. Por 30 dias você ainda entra para exportar ou reabrir; depois, tudo é apagado de vez:
                casos, consultas, documentos e auditoria.
              </p>
              <div className="campo">
                <label htmlFor="confirmacao-nome">Digite o nome do escritório: {s.escritorio}</label>
                <input id="confirmacao-nome" name="confirmacao" autoComplete="off" required />
              </div>
              <div className="campo">
                <label htmlFor="senha-encerrar">Sua senha</label>
                <input id="senha-encerrar" name="senha" type="password" autoComplete="current-password" required />
              </div>
            </FormAcao>
          )}
        </div>
      )}
    </>
  );
}

function detalhe(a: { acao: string; detalhes: Record<string, unknown> }): string {
  const x = a.detalhes ?? {};
  if (a.acao === "mudanca_nivel") return `${ROTULO_NIVEL[x.de as Nivel] ?? x.de} → ${ROTULO_NIVEL[x.para as Nivel] ?? x.para}`;
  if (a.acao === "convite") return `${x.email} como ${ROTULO_NIVEL[x.nivel as Nivel] ?? x.nivel}${x.aguarda_titular ? ", aguardando assento" : ""}`;
  if (a.acao === "login") return [x.aparelho, x.cidade].filter(Boolean).join(" · ");
  if (a.acao === "consulta") return String(x.status ?? "");
  if (a.acao === "exportacao_parecer") return String(x.formato ?? "").toUpperCase();
  if (a.acao === "configuracao") return Object.keys(x).join(", ");
  if (a.acao === "assinatura") return [x.status, x.assentos ? `${x.assentos} assentos` : null, x.plano].filter(Boolean).join(" · ");
  return "";
}

function Consumo({ linhas, plano }: { linhas: any[]; plano: string }) {
  const meses = [...new Set(linhas.map((l) => String(l.mes).slice(0, 10)))];
  const esteMes = meses[0];
  const doMes = linhas.filter((l) => String(l.mes).slice(0, 10) === esteMes);
  const total = doMes.reduce((n, l) => n + l.consultas, 0);
  const custo = doMes.reduce((n, l) => n + Number(l.custo_microreais), 0);
  const limite = limiteMensal(plano);
  return (
    <div className="mesa-coluna">
      <div className="mesa-numeros">
        <div className="mesa-numero">
          <span>Consultas neste mês</span>
          <strong>{total}</strong>
          {limite ? (
            <>
              <span>de {limite} do plano</span>
              <div className="mesa-barra"><i style={{ width: `${Math.min(100, (total / limite) * 100)}%` }} /></div>
            </>
          ) : (
            <span>O plano não define limite mensal.</span>
          )}
        </div>
        <div className="mesa-numero">
          <span>Custo de IA neste mês</span>
          <strong>{reais(custo)}</strong>
          <span>Registrado consulta a consulta.</span>
        </div>
        <div className="mesa-numero">
          <span>Pessoas que consultaram</span>
          <strong>{doMes.length}</strong>
          <span>neste mês</span>
        </div>
      </div>
      {linhas.length === 0 ? (
        <p className="mesa-vazio-cartao">Nenhuma consulta nos últimos 6 meses.</p>
      ) : (
        <div className="tabela-envolve">
          <table className="tabela">
            <thead>
              <tr><th>Mês</th><th className="esq">Pessoa</th><th>Consultas</th><th>Custo de IA</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.mes}-${l.usuario_id}`}>
                  <td>{mes(l.mes)}</td>
                  <td className="esq">{l.nome}</td>
                  <td>{l.consultas}</td>
                  <td>{reais(l.custo_microreais)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function Plano({ cobranca, plano, convites, ok }: { cobranca: any; plano: string; convites: any[]; ok: boolean }) {
  const configurado = stripeConfigurado();
  const faturas = configurado && cobranca?.stripe_cliente_id ? await listarFaturas(cobranca.stripe_cliente_id).then((f) => f.data).catch(() => null) : null;
  return (
    <div className="mesa-coluna">
      {ok && <p className="alerta info">Pagamento recebido pelo Stripe. A assinatura aparece aqui assim que o Stripe confirmar.</p>}
      <div className="mesa-numeros">
        <div className="mesa-numero">
          <span>Plano</span>
          <strong>{ROTULO_PLANO[plano] ?? plano}</strong>
          <span>{cobranca?.assinatura_status ? `assinatura ${cobranca.assinatura_status}` : "sem assinatura ativa"}</span>
        </div>
        <div className="mesa-numero">
          <span>Assentos em uso</span>
          <strong>
            {cobranca?.em_uso ?? 0}
            {cobranca?.assentos ? ` de ${cobranca.assentos}` : ""}
          </strong>
          <span>Pessoas ativas e convites pendentes. Suspensos não contam.</span>
        </div>
      </div>

      {convites.length > 0 && (
        <section className="bloco">
          <p className="mesa-rotulo">Convites esperando um assento</p>
          <ul className="mesa-pessoas">
            {convites.map((x) => (
              <li key={x.id} className="mesa-pessoa">
                <span className="mesa-pessoa-quem"><span><strong>{x.email}</strong><small>{ROTULO_NIVEL[x.nivel as Nivel]}</small></span></span>
                <span />
                <FormAcao acao={liberarConvite} botao="Liberar e somar 1 assento" pendente="Liberando…" classe="mesa-form-linha">
                  <input type="hidden" name="id" value={x.id} />
                </FormAcao>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!configurado ? (
        <p className="alerta aviso">
          A cobrança no Stripe ainda não foi configurada neste ambiente (STRIPE_CHAVE). Enquanto isso, não há limite de assentos.
        </p>
      ) : cobranca?.stripe_assinatura_id ? (
        <div className="mesa-cartao">
          <h2>Cartão, faturas e plano</h2>
          <p>O cartão fica guardado só no Stripe. Trocar de plano, mudar o cartão e cancelar acontecem no portal do Stripe.</p>
          <form action={abrirPortal} className="mesa-form-pe" style={{ justifyContent: "flex-start" }}>
            <button className="mesa-botao">Abrir o portal de cobrança</button>
          </form>
        </div>
      ) : (
        <FormAcao acao={assinar} botao="Assinar pelo Stripe" pendente="Abrindo o Stripe…">
          <h2>Assinar</h2>
          <p>Cobrança por pessoa, todo mês, no cartão. Os assentos começam pelo número de pessoas de hoje.</p>
          <fieldset className="mesa-escolhas">
            <legend>Plano</legend>
            {PLANOS.filter((p) => precoDoPlano(p)).map((p) => (
              <label key={p} className="mesa-escolha">
                <input type="radio" name="plano" value={p} defaultChecked={p === "escritorio"} />
                <span>{ROTULO_PLANO[p]}</span>
              </label>
            ))}
          </fieldset>
        </FormAcao>
      )}

      {faturas && faturas.length > 0 && (
        <section className="bloco">
          <p className="mesa-rotulo">Faturas</p>
          <ul className="mesa-lista">
            {faturas.map((f) => (
              <li key={f.id}>
                <span>
                  {f.number ?? f.id} · {new Date(f.created * 1000).toLocaleDateString("pt-BR")}
                </span>
                <span>
                  {formatarReais(f.total)} · {f.status}
                  {f.hosted_invoice_url && (
                    <>
                      {" · "}
                      <a href={f.hosted_invoice_url} target="_blank" rel="noopener noreferrer">ver</a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mesa-nota">A nota fiscal de serviço (NFS-e) não sai pelo Stripe; a emissão será ligada a um emissor brasileiro.</p>
        </section>
      )}
    </div>
  );
}
