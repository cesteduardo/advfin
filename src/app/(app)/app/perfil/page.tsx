import { Abas } from "@/components/app/Abas";
import { Cabeca } from "@/components/app/Cabeca";
import { FormAcao } from "@/components/app/FormAcao";
import { DoisFatores } from "@/components/app/perfil/DoisFatores";
import { SeletorImagem } from "@/components/app/perfil/Foto";
import { trocarEscritorio } from "@/lib/auth/acoes";
import { ROTULO_NIVEL, acimaOuIgual, type Nivel } from "@/lib/auth/niveis";
import { exigirSessao, hashSessaoAtual } from "@/lib/auth/sessao";
import { noEscritorio } from "@/lib/db";
import {
  encerrarOutrasSessoes, encerrarSessaoPorId, pedirExclusaoConta, pedirTrocaEmail, sairDoEscritorio, salvarDados, salvarFoto, salvarPreferencias, trocarSenha,
} from "@/lib/perfil/acoes";

export const metadata = { title: "Perfil — AdvFin" };

const ABAS = [
  { id: "dados", nome: "Dados" },
  { id: "seguranca", nome: "Segurança" },
  { id: "preferencias", nome: "Preferências" },
  { id: "escritorios", nome: "Meus escritórios" },
  { id: "privacidade", nome: "Privacidade" },
];
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const quando = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—";

export default async function Perfil({ searchParams }: { searchParams: Promise<{ aba?: string; exigido?: string }> }) {
  const s = await exigirSessao();
  const { aba: pedida, exigido } = await searchParams;
  const aba = ABAS.some((a) => a.id === pedida) ? pedida! : s.precisa2fa ? "seguranca" : "dados";
  const atual = await hashSessaoAtual();

  const { perfil, sessoes, escritorios, registro, exige } = await noEscritorio(s, async (c) => ({
    perfil: (await c.query(`select * from app.meu_perfil()`)).rows[0],
    sessoes: aba === "seguranca" ? (await c.query(`select * from app.minhas_sessoes($1)`, [atual])).rows : [],
    escritorios: aba === "escritorios" ? (await c.query(`select * from app.meus_escritorios()`)).rows : [],
    registro: aba === "privacidade" ? (await c.query(`select operacao, finalidade, base_legal, dados, retencao from registro_tratamento order by id`)).rows : [],
    exige: (await c.query(`select exige_2fa from escritorios where id = $1`, [s.escritorioId])).rows[0]?.exige_2fa as string,
  }));
  const obrigatorio2fa = exige === "todos" || (exige === "admins" && acimaOuIgual(s.nivel, "admin"));

  return (
    <>
      <Cabeca trilha={`${s.escritorio} / Perfil`} titulo={perfil.nome} descricao={`${ROTULO_NIVEL[s.nivel]}${s.cargo ? ` · ${s.cargo}` : ""} · ${perfil.email}`}>
        <Abas base="/app/perfil" abas={ABAS} atual={aba} rotulo="Seções do perfil" />
      </Cabeca>

      {s.precisa2fa && (
        <p className="alerta aviso" role="alert">
          {exigido ? "Para continuar, " : ""}o escritório exige a verificação em duas etapas para o seu nível. Ative abaixo para liberar o
          resto do AdvFin.
        </p>
      )}

      {aba === "dados" && (
        <div className="mesa-grade-2">
          <div className="mesa-coluna">
            <div className="mesa-cartao">
              <h2>Foto</h2>
              <SeletorImagem atual={perfil.foto_url} nome={perfil.nome} salvar={salvarFoto} rotulo="foto" />
            </div>
            <FormAcao acao={salvarDados} botao="Salvar dados">
              <h2>Dados</h2>
              <div className="campo">
                <label htmlFor="nome">Nome</label>
                <input id="nome" name="nome" defaultValue={perfil.nome} autoComplete="name" required />
              </div>
              <div className="campo">
                <label htmlFor="cargo">Cargo em {s.escritorio}</label>
                <input id="cargo" name="cargo" defaultValue={s.cargo ?? ""} placeholder="Sócio, Associada, Paralegal…" maxLength={80} />
                <span className="ajuda">Aparece no perfil e na assinatura do parecer. Não muda o que você pode fazer no AdvFin.</span>
              </div>
              <div className="duas-col">
                <div className="campo">
                  <label htmlFor="oab_numero">OAB (número)</label>
                  <input id="oab_numero" name="oab_numero" defaultValue={perfil.oab_numero ?? ""} inputMode="numeric" maxLength={20} />
                </div>
                <div className="campo">
                  <label htmlFor="oab_uf">UF</label>
                  <select id="oab_uf" name="oab_uf" defaultValue={perfil.oab_uf?.trim() ?? ""}>
                    <option value="">—</option>
                    {UFS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              {perfil.oab_numero && (
                <p className="mesa-nota">
                  {perfil.oab_verificada_em ? (
                    <span className="selo publicado">OAB conferida pela equipe AdvFin</span>
                  ) : (
                    <span className="selo em_revisao">OAB declarada, ainda não conferida</span>
                  )}
                </p>
              )}
            </FormAcao>
          </div>
          <FormAcao acao={pedirTrocaEmail} botao="Trocar e-mail" pendente="Enviando…">
            <h2>E-mail</h2>
            <p>
              Hoje: <strong>{perfil.email}</strong>. O endereço novo só passa a valer depois que você abrir o link enviado para ele.
            </p>
            {perfil.email_pendente && <p className="alerta aviso">Aguardando a confirmação de {perfil.email_pendente}.</p>}
            <div className="campo">
              <label htmlFor="email-novo">E-mail novo</label>
              <input id="email-novo" name="email" type="email" autoComplete="email" required />
            </div>
          </FormAcao>
        </div>
      )}

      {aba === "seguranca" && (
        <div className="mesa-coluna">
          <DoisFatores ativo={perfil.totp_ativo} restantes={perfil.codigos_restantes} obrigatorio={obrigatorio2fa} />
          <div className="mesa-grade-2">
            <FormAcao acao={trocarSenha} botao="Trocar senha" pendente="Trocando…">
              <h2>Senha</h2>
              <p>{perfil.senha_trocada_em ? `Trocada em ${quando(perfil.senha_trocada_em)}.` : "Ainda é a do cadastro."} Ao trocar, os outros aparelhos saem.</p>
              <div className="campo">
                <label htmlFor="atual">Senha atual</label>
                <input id="atual" name="atual" type="password" autoComplete="current-password" required />
              </div>
              <div className="campo">
                <label htmlFor="nova">Senha nova</label>
                <input id="nova" name="nova" type="password" autoComplete="new-password" minLength={10} required />
                <span className="ajuda">Ao menos 10 caracteres.</span>
              </div>
              <div className="campo">
                <label htmlFor="confirmacao">Repita a senha nova</label>
                <input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
              </div>
            </FormAcao>
            <div className="mesa-cartao">
              <h2>Sessões abertas</h2>
              <ul className="mesa-lista" style={{ padding: 0, boxShadow: "none" }}>
                {sessoes.map((x: any) => (
                  <li key={x.id}>
                    <span>
                      <strong>{x.aparelho ?? "Aparelho desconhecido"}</strong>
                      {x.cidade ? ` · ${x.cidade}` : ""} · {x.escritorio}
                      <br />
                      <small className="mesa-nota">Último uso {quando(x.ultimo_uso_em)}</small>
                    </span>
                    {x.atual ? (
                      <span className="selo publicado">Este aparelho</span>
                    ) : (
                      <form action={encerrarSessaoPorId}>
                        <input type="hidden" name="id" value={x.id} />
                        <button className="mesa-botao secundario" style={{ minHeight: 34, padding: "6px 14px", fontSize: 13 }}>Encerrar</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              {sessoes.length > 1 && (
                <form action={encerrarOutrasSessoes} className="mesa-form-pe">
                  <button className="mesa-botao secundario">Encerrar todas as outras</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {aba === "preferencias" && (
        <FormAcao acao={salvarPreferencias} botao="Salvar preferências">
          <h2>Preferências</h2>
          <fieldset className="mesa-escolhas">
            <legend>Data de vigência que a pesquisa usa ao abrir</legend>
            <label className="mesa-escolha">
              <input type="radio" name="vigencia_modo" value="hoje" defaultChecked={!perfil.preferencias?.vigencia || perfil.preferencias.vigencia === "hoje"} />
              <span>Hoje<small>O que vale na data de cada consulta.</small></span>
            </label>
            <label className="mesa-escolha">
              <input type="radio" name="vigencia_modo" value="data" defaultChecked={/^\d{4}/.test(perfil.preferencias?.vigencia ?? "")} />
              <span>
                Uma data fixa<small>Para quem trabalha casos de um período antigo.</small>
                <input type="date" name="vigencia_data" min="2023-12-21" defaultValue={/^\d{4}/.test(perfil.preferencias?.vigencia ?? "") ? perfil.preferencias.vigencia : ""} aria-label="Data fixa de vigência" style={{ marginTop: 6, maxWidth: 200 }} />
              </span>
            </label>
          </fieldset>
          <div className="campo">
            <label htmlFor="modelo">Modelo de IA</label>
            <select id="modelo" disabled defaultValue="padrao">
              <option value="padrao">O do escritório</option>
            </select>
            <span className="ajuda">A escolha aparece quando houver mais de um modelo disponível.</span>
          </div>
          <fieldset className="mesa-escolhas">
            <legend>Avisos por e-mail</legend>
            {[
              ["aviso_convites", "convites", "Quando eu for incluído num caso ou convidado para um escritório"],
              ["aviso_revisoes", "revisoes", "Quando um pedido de revisão meu for decidido, ou houver um para eu revisar"],
              ["aviso_resumo", "resumo", "Resumo semanal das mudanças na base normativa"],
            ].map(([nome, chave, texto]) => (
              <label key={nome} className="mesa-escolha">
                <input type="checkbox" name={nome} defaultChecked={perfil.preferencias?.avisos?.[chave] ?? chave !== "resumo"} />
                <span>{texto}</span>
              </label>
            ))}
          </fieldset>
        </FormAcao>
      )}

      {aba === "escritorios" && (
        <div className="mesa-coluna">
          <ul className="mesa-pessoas">
            {escritorios.map((e: any) => (
              <li key={e.escritorio_id} className="mesa-pessoa">
                <span className="mesa-pessoa-quem">
                  <span>
                    <strong>{e.nome}</strong>
                    <small>{e.cargo ?? "Sem cargo informado"}</small>
                  </span>
                </span>
                <span className="mesa-pessoa-info">
                  <span className={`selo nivel-${e.nivel}`}>{ROTULO_NIVEL[e.nivel as Nivel]}</span>
                </span>
                {e.atual ? (
                  <span className="selo publicado">Aberto agora</span>
                ) : (
                  <form action={trocarEscritorio}>
                    <input type="hidden" name="escritorio" value={e.escritorio_id} />
                    <button className="mesa-botao secundario" style={{ minHeight: 36, fontSize: 13.5 }}>Abrir</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {s.nivel !== "titular" ? (
            <FormAcao acao={sairDoEscritorio} botao={`Sair de ${s.escritorio}`} pendente="Saindo…" perigo>
              <h2>Sair deste escritório</h2>
              <p>
                Sua conta continua sua. As consultas que você fez para o escritório ficam com ele, que é quem responde por esses dados.
              </p>
              <div className="campo">
                <label htmlFor="senha-sair">Senha, para confirmar</label>
                <input id="senha-sair" name="senha" type="password" autoComplete="current-password" required />
              </div>
            </FormAcao>
          ) : (
            <p className="mesa-nota">Você é o Titular de {s.escritorio}. Para sair, transfira antes a titularidade em Escritório › Dados.</p>
          )}
        </div>
      )}

      {aba === "privacidade" && (
        <div className="mesa-coluna">
          <div className="mesa-grade-2">
            <div className="mesa-cartao">
              <h2>Meus dados</h2>
              <p>Um arquivo JSON com perfil, vínculos, sessões e o registro das suas ações. Senha e segredo do 2FA não saem.</p>
              <div className="mesa-form-pe" style={{ justifyContent: "flex-start" }}>
                <a className="mesa-botao" href="/app/perfil/meus-dados" download>Baixar meus dados</a>
              </div>
            </div>
            <FormAcao acao={pedirExclusaoConta} botao="Excluir minha conta" pendente="Excluindo…" perigo>
              <h2>Excluir a conta</h2>
              <p>
                O acesso acaba na hora e os dados pessoais são apagados em até 15 dias. As consultas feitas para um escritório continuam
                com ele, com o seu nome trocado por &quot;ex-membro&quot;.
              </p>
              {s.nivel === "titular" && <p className="alerta aviso">Você é Titular: transfira a titularidade antes de excluir a conta.</p>}
              <div className="campo">
                <label htmlFor="confirmacao-email">Digite seu e-mail para confirmar</label>
                <input id="confirmacao-email" name="confirmacao" type="email" autoComplete="off" required />
              </div>
              <div className="campo">
                <label htmlFor="senha-excluir">Senha</label>
                <input id="senha-excluir" name="senha" type="password" autoComplete="current-password" required />
              </div>
            </FormAcao>
          </div>
          <section className="bloco">
            <p className="mesa-rotulo">O que o AdvFin faz com os dados (LGPD, art. 37)</p>
            <div className="tabela-envolve">
              <table className="tabela">
                <thead>
                  <tr><th>Operação</th><th className="esq">Para quê</th><th className="esq">Base legal</th><th className="esq">Dados</th><th className="esq">Guarda</th></tr>
                </thead>
                <tbody>
                  {registro.map((r: any) => (
                    <tr key={r.operacao}>
                      <td className="esq">{r.operacao}</td><td className="esq">{r.finalidade}</td><td className="esq">{r.base_legal}</td><td className="esq">{r.dados}</td><td className="esq">{r.retencao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
