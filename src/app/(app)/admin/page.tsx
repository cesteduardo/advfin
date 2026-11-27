import { Abas } from "@/components/app/Abas";
import { Cabeca } from "@/components/app/Cabeca";
import { FormAcao } from "@/components/app/FormAcao";
import { ROTULO_PAPEL_PLATAFORMA } from "@/lib/auth/niveis";
import { exigirPlataforma } from "@/lib/auth/sessao";
import { comoUsuario } from "@/lib/db";
import { decidirCuradoria, definirPapel, verificarOab } from "@/lib/plataforma/acoes";
import { ROTULO_PLANO } from "@/lib/stripe";
import { Seletor } from "@/components/ui/Seletor";

export const metadata = { title: "Plataforma — AdvFin" };

const dia = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");

export default async function Plataforma({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const s = await exigirPlataforma(["curador", "suporte"]);
  const papel = s.plataforma!;
  const suporte = papel === "admin" || papel === "suporte";
  const curador = papel === "admin" || papel === "curador";
  const abas = [
    ...(curador ? [{ id: "curadoria", nome: "Curadoria" }] : []),
    ...(suporte ? [{ id: "escritorios", nome: "Escritórios" }, { id: "oab", nome: "OAB" }, { id: "lgpd", nome: "LGPD" }] : []),
    ...(papel === "admin" ? [{ id: "equipe", nome: "Equipe" }] : []),
  ];
  const { aba: pedida } = await searchParams;
  const aba = abas.some((a) => a.id === pedida) ? pedida! : abas[0].id;

  const d = await comoUsuario(s.usuarioId, async (c) => {
    const q = async (sql: string) => (await c.query(sql)).rows;
    return {
      fila: aba === "curadoria" ? await q(`select * from app.plat_curadoria_fila()`) : [],
      escritorios: aba === "escritorios" ? await q(`select * from app.plat_escritorios()`) : [],
      oab: aba === "oab" ? await q(`select * from app.plat_oab_pendentes()`) : [],
      pedidos: aba === "lgpd" ? await q(`select * from app.plat_pedidos_exclusao()`) : [],
      equipe: aba === "equipe" ? await q(`select * from app.plat_equipe()`) : [],
    };
  });

  return (
    <>
      <Cabeca trilha="AdvFin / Plataforma" titulo="Plataforma" descricao={`${ROTULO_PAPEL_PLATAFORMA[papel]}. Nada daqui mostra o conteúdo das consultas dos escritórios.`}>
        <Abas base="/admin" abas={abas.map((a) => (a.id === "curadoria" ? { ...a, conta: d.fila.length || undefined } : a))} atual={aba} rotulo="Seções da plataforma" />
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
