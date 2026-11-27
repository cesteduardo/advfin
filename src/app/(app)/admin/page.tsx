import { Abas } from "@/components/app/Abas";
import { Cabeca } from "@/components/app/Cabeca";
import { FormAcao } from "@/components/app/FormAcao";
import { ROTULO_PAPEL_PLATAFORMA } from "@/lib/auth/niveis";
import { exigirPlataforma } from "@/lib/auth/sessao";
import { comoUsuario } from "@/lib/db";
import { decidirCuradoria, decidirRelato, definirLimite, definirPapel, verificarOab } from "@/lib/plataforma/acoes";
import { limitesPadrao } from "@/lib/uso/limites";
import { ROTULO_PLANO } from "@/lib/stripe";
import { Seletor } from "@/components/ui/Seletor";

export const metadata = { title: "Plataforma — AdvFin" };

const hora = (d: Date | string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const padrao = limitesPadrao();
const MOTIVO_RELATO: Record<string, string> = {
  texto_diferente: "Texto não confere com o oficial",
  dispositivo_errado: "Artigo, parágrafo ou inciso errado",
  fora_de_vigencia: "Revogado ou fora de vigência",
  nao_sustenta: "O trecho não sustenta a afirmação",
  outro: "Outro problema",
};
const dia = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");

export default async function Plataforma({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const s = await exigirPlataforma(["curador", "suporte"]);
  const papel = s.plataforma!;
  const suporte = papel === "admin" || papel === "suporte";
  const curador = papel === "admin" || papel === "curador";
  const abas = [
    ...(curador ? [{ id: "curadoria", nome: "Curadoria" }, { id: "relatos", nome: "Relatos" }] : []),
    ...(suporte
      ? [
          { id: "escritorios", nome: "Escritórios" },
          { id: "limites", nome: "Limites" },
          { id: "erros", nome: "Erros" },
          { id: "oab", nome: "OAB" },
          { id: "lgpd", nome: "LGPD" },
        ]
      : []),
    ...(papel === "admin" ? [{ id: "equipe", nome: "Equipe" }] : []),
  ];
  const { aba: pedida } = await searchParams;
  const aba = abas.some((a) => a.id === pedida) ? pedida! : abas[0].id;

  const d = await comoUsuario(s.usuarioId, async (c) => {
    const q = async (sql: string) => (await c.query(sql)).rows;
    return {
      fila: aba === "curadoria" ? await q(`select * from app.plat_curadoria_fila()`) : [],
      escritorios: aba === "escritorios" || aba === "limites" ? await q(`select * from app.plat_escritorios()`) : [],
      relatos: curador ? await q(`select * from app.plat_relatos()`) : [],
      limites: aba === "limites" ? await q(`select * from app.plat_limites()`) : [],
      erros: aba === "erros" ? await q(`select * from app.plat_erros(14)`) : [],
      oab: aba === "oab" ? await q(`select * from app.plat_oab_pendentes()`) : [],
      pedidos: aba === "lgpd" ? await q(`select * from app.plat_pedidos_exclusao()`) : [],
      equipe: aba === "equipe" ? await q(`select * from app.plat_equipe()`) : [],
    };
  });

  return (
    <>
      <Cabeca trilha="AdvFin / Plataforma" titulo="Plataforma" descricao={`${ROTULO_PAPEL_PLATAFORMA[papel]}. Nada daqui mostra o conteúdo das consultas dos escritórios.`}>
        <Abas base="/admin" abas={abas.map((a) =>
            a.id === "curadoria"
              ? { ...a, conta: d.fila.length || undefined }
              : a.id === "relatos"
                ? { ...a, conta: d.relatos.filter((r: any) => r.status === "aberto").length || undefined }
                : a,
          )} atual={aba} rotulo="Seções da plataforma" />
      </Cabeca>

      {aba === "curadoria" && (
        <div className="mesa-coluna">
          {d.fila.length === 0 && <p className="mesa-vazio-cartao">Nada na fila. Tudo o que entrou na base já foi decidido.</p>}
          {d.fila.map((f: any) => (
            <div key={f.id} className="mesa-cartao">
              <div className="mesa-topo" style={{ alignItems: "center" }}>
                <h2>
                  {f.norma}, {f.rotulo}
                </h2>
                <span className={`selo ${f.origem === "semente" ? "semente" : f.status_curadoria}`}>
                  {f.origem === "semente" ? "Semente provisória" : f.status_curadoria === "rascunho" ? "Rascunho do Planalto" : "Em revisão"}
                </span>
              </div>
              <p className="mesa-nota">
                Vigência desde {dia(f.vigencia_inicio)}
                {f.vigencia_fim ? ` até ${dia(f.vigencia_fim)}` : ""} ·{" "}
                <a href={f.url_oficial} target="_blank" rel="noopener noreferrer">texto oficial no Planalto</a>
              </p>
              <div className="curadoria-par">
                <div>
                  <p className="mesa-rotulo">Na base</p>
                  <blockquote>{f.texto}</blockquote>
                </div>
                <div>
                  <p className="mesa-rotulo">Ingerido do Planalto</p>
                  <blockquote>{f.texto_planalto ?? (f.origem === "ingestao" ? f.texto : "Ainda não ingerido. Rode scripts/ingerir-planalto.mjs.")}</blockquote>
                </div>
              </div>
              {f.nota && <p className="mesa-nota">Nota: {f.nota}</p>}
              <div className="mesa-acoes">
                {[
                  ["publicado", "Aprovar e publicar", ""],
                  ["rejeitado", "Rejeitar", "secundario"],
                  ["em_revisao", "Só anotar", "secundario"],
                ].map(([status, rotulo, cls]) => (
                  <FormAcao key={status} acao={decidirCuradoria} botao={rotulo} pendente="…" classe="mesa-form-linha" secundario={cls === "secundario"}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="status" value={status} />
                    {status === "em_revisao" && <input name="nota" placeholder="Anotação" maxLength={500} aria-label="Anotação" className="mesa-input-linha" />}
                  </FormAcao>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {aba === "relatos" && (
        <div className="mesa-coluna">
          <p className="mesa-nota">
            Relatos de citação errada enviados pelos advogados. Aparecem o dispositivo, o trecho e o motivo; a pergunta não vem
            junto. Procedente com “tirar da pesquisa” devolve o dispositivo à fila de curadoria até você republicar.
          </p>
          {d.relatos.length === 0 && <p className="mesa-vazio-cartao">Nenhum relato. Quando um advogado apontar um erro, ele aparece aqui.</p>}
          {d.relatos.map((r: any) => (
            <div key={r.id} className="mesa-cartao">
              <div className="mesa-topo" style={{ alignItems: "center" }}>
                <h2>
                  {r.norma}, {r.rotulo}
                </h2>
                <span className={`selo ${r.status === "aberto" ? "em_revisao" : r.status === "procedente" ? "rejeitado" : "publicado"}`}>
                  {r.status === "aberto" ? (r.repeticoes > 1 ? `Aberto · ${r.repeticoes} relatos` : "Aberto") : r.status === "procedente" ? "Procedente" : "Improcedente"}
                </span>
              </div>
              <p className="mesa-nota">
                {MOTIVO_RELATO[r.motivo] ?? r.motivo} · {dia(r.criado_em)} · dispositivo {r.status_curadoria.replace("_", " ")} ·{" "}
                <a href={r.url_oficial} target="_blank" rel="noopener noreferrer">texto oficial no Planalto</a>
              </p>
              <div className="curadoria-par">
                <div>
                  <p className="mesa-rotulo">Trecho citado</p>
                  <blockquote>{r.trecho || "—"}</blockquote>
                </div>
                <div>
                  <p className="mesa-rotulo">Dispositivo na base</p>
                  <blockquote>{r.texto}</blockquote>
                </div>
              </div>
              {r.comentario && <p className="mesa-nota">Comentário de quem relatou: {r.comentario}</p>}
              {r.status === "aberto" && (
                <div className="mesa-acoes">
                  <FormAcao acao={decidirRelato} botao="Procedente" pendente="…" classe="mesa-form-linha">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="procedente" />
                    <input name="nota" placeholder="O que corrigir" maxLength={500} aria-label="Nota da curadoria" className="mesa-input-linha" />
                    <label className="mesa-nota" style={{ display: "inline-flex", gap: 6, alignItems: "center", margin: 0 }}>
                      <input type="checkbox" name="tirar" defaultChecked /> tirar da pesquisa
                    </label>
                  </FormAcao>
                  <FormAcao acao={decidirRelato} botao="Improcedente" pendente="…" classe="mesa-form-linha" secundario>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="improcedente" />
                  </FormAcao>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {aba === "limites" && (
        <div className="mesa-grade-2">
          <div className="mesa-coluna">
            <p className="mesa-nota">
              Padrão do servidor: {padrao.minuto} por minuto, {padrao.dia} por dia e {padrao.mes} por mês por pessoa; {padrao.escritorio} por
              mês por escritório. Mude nas variáveis LIMITE_* da Vercel. Abaixo, só as exceções.
            </p>
            {d.limites.length === 0 ? (
              <p className="mesa-vazio-cartao">Nenhum escritório com limite especial.</p>
            ) : (
              <div className="tabela-envolve">
                <table className="tabela">
                  <thead>
                    <tr><th className="esq">Escritório</th><th>Dia/pessoa</th><th>Mês/pessoa</th><th>Mês/escritório</th><th>Usadas no mês</th><th className="esq">Nota</th></tr>
                  </thead>
                  <tbody>
                    {d.limites.map((l: any) => (
                      <tr key={l.escritorio_id}>
                        <td className="esq">{l.escritorio}</td>
                        <td>{l.consultas_dia_pessoa ?? "padrão"}</td>
                        <td>{l.consultas_mes_pessoa ?? "padrão"}</td>
                        <td>{l.consultas_mes_escritorio ?? "padrão"}</td>
                        <td>{l.consultas_mes}</td>
                        <td className="esq">{l.nota ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <FormAcao acao={definirLimite} botao="Salvar limite">
            <h2>Limite especial</h2>
            <p>Deixe um campo em branco para usar o padrão. Os três em branco apagam a exceção.</p>
            <div className="campo">
              <label htmlFor="lim-esc">Escritório</label>
              <select id="lim-esc" name="escritorio" required>
                {d.escritorios.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.nome} · {e.titular ?? "sem titular"}</option>
                ))}
              </select>
            </div>
            <div className="campo"><label htmlFor="lim-dia">Consultas por dia, por pessoa</label><input id="lim-dia" name="dia" inputMode="numeric" /></div>
            <div className="campo"><label htmlFor="lim-mes">Consultas por mês, por pessoa</label><input id="lim-mes" name="mes" inputMode="numeric" /></div>
            <div className="campo"><label htmlFor="lim-esc-mes">Consultas por mês, no escritório</label><input id="lim-esc-mes" name="escritorio_mes" inputMode="numeric" /></div>
            <div className="campo"><label htmlFor="lim-nota">Nota</label><input id="lim-nota" name="nota" maxLength={300} placeholder="Ex.: programa fundador" /></div>
          </FormAcao>
        </div>
      )}

      {aba === "erros" && (
        <div className="mesa-coluna">
          <p className="mesa-nota">Últimos 14 dias, do mais recente. Só o técnico: rota, mensagem e código. O conteúdo das consultas não é registrado.</p>
          {d.erros.length === 0 ? (
            <p className="mesa-vazio-cartao">Nenhum erro registrado nos últimos 14 dias.</p>
          ) : (
            <div className="tabela-envolve">
              <table className="tabela">
                <thead><tr><th className="esq">Quando</th><th>Origem</th><th className="esq">Mensagem</th><th className="esq">Rota</th><th className="esq">Escritório</th></tr></thead>
                <tbody>
                  {d.erros.map((e: any) => (
                    <tr key={e.id}>
                      <td className="esq">{hora(e.criado_em)}</td>
                      <td>{e.origem}{e.codigo ? ` · ${e.codigo}` : ""}</td>
                      <td className="esq" style={{ maxWidth: 520, overflowWrap: "anywhere" }}>{e.mensagem}</td>
                      <td className="esq">{e.rota ?? "—"}</td>
                      <td className="esq">{e.escritorio ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aba === "escritorios" && (
        <div className="tabela-envolve">
          <table className="tabela">
            <thead>
              <tr><th className="esq">Escritório</th><th className="esq">Titular</th><th>Plano</th><th>Assinatura</th><th>Pessoas</th><th>Consultas 30 dias</th><th>Desde</th></tr>
            </thead>
            <tbody>
              {d.escritorios.map((e: any) => (
                <tr key={e.id}>
                  <td className="esq">{e.nome}{e.encerrado_em ? <small> · encerrado em {dia(e.encerrado_em)}</small> : null}</td>
                  <td className="esq">{e.titular ?? "—"}</td>
                  <td>{ROTULO_PLANO[e.plano] ?? e.plano}</td>
                  <td>{e.assinatura_status ?? "sem assinatura"}{e.assentos ? ` · ${e.assentos} assentos` : ""}</td>
                  <td>{e.membros}</td>
                  <td>{e.consultas_30d}</td>
                  <td>{dia(e.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === "oab" && (
        <div className="mesa-coluna">
          <p className="mesa-nota">
            Conferência à mão no Cadastro Nacional dos Advogados (cna.oab.org.br). A integração automática segue em aberto no plano.
          </p>
          {d.oab.length === 0 ? (
            <p className="mesa-vazio-cartao">Nenhuma OAB aguardando conferência.</p>
          ) : (
            <ul className="mesa-lista">
              {d.oab.map((o: any) => (
                <li key={o.usuario_id}>
                  <span>
                    <strong>{o.nome}</strong> · {o.email} · OAB {o.oab}
                  </span>
                  <form action={verificarOab}>
                    <input type="hidden" name="usuario" value={o.usuario_id} />
                    <button className="mesa-botao secundario" style={{ minHeight: 34, padding: "6px 14px", fontSize: 13 }}>Marcar como conferida</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {aba === "lgpd" && (
        <div className="mesa-coluna">
          <p className="mesa-nota">A conta sai na hora; o expurgo (scripts/expurgo.mjs, diário) apaga os dados pessoais dentro do prazo de 15 dias.</p>
          {d.pedidos.length === 0 ? (
            <p className="mesa-vazio-cartao">Nenhum pedido de exclusão.</p>
          ) : (
            <div className="tabela-envolve">
              <table className="tabela">
                <thead><tr><th className="esq">E-mail</th><th>Pedido</th><th>Prazo</th><th>Situação</th></tr></thead>
                <tbody>
                  {d.pedidos.map((p: any) => (
                    <tr key={p.id}>
                      <td className="esq">{p.email}</td>
                      <td>{dia(p.solicitado_em)}</td>
                      <td>{dia(p.prazo_em)}</td>
                      <td>{p.concluido_em ? `concluído em ${dia(p.concluido_em)}` : new Date(p.prazo_em) < new Date() ? "atrasado" : "aguardando o expurgo"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aba === "equipe" && (
        <div className="mesa-grade-2">
          <ul className="mesa-lista">
            {d.equipe.map((m: any) => (
              <li key={m.usuario_id}>
                <span><strong>{m.nome}</strong> · {m.email}</span>
                <span>{ROTULO_PAPEL_PLATAFORMA[m.papel]}</span>
              </li>
            ))}
          </ul>
          <FormAcao acao={definirPapel} botao="Salvar">
            <h2>Papel na plataforma</h2>
            <p>A pessoa precisa ter conta no AdvFin. O papel não dá acesso a nenhum escritório.</p>
            <div className="campo">
              <label htmlFor="eq-email">E-mail</label>
              <input id="eq-email" name="email" type="email" required />
            </div>
            <div className="campo">
              <label htmlFor="eq-papel">Papel</label>
              <Seletor
                id="eq-papel"
                name="papel"
                defaultValue="curador"
                opcoes={[
                  { valor: "curador", rotulo: "Curadoria da base normativa" },
                  { valor: "suporte", rotulo: "Suporte" },
                  { valor: "admin", rotulo: "Administração da plataforma" },
                  { valor: "nenhum", rotulo: "Tirar da equipe" },
                ]}
              />
            </div>
          </FormAcao>
        </div>
      )}
    </>
  );
}
