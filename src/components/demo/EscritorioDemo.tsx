"use client";

import { DockSecoes } from "@/components/app/DockSecoes";
import { useState, type CSSProperties, type FormEvent } from "react";
import { Cabeca } from "@/components/app/Cabeca";
import { Avatar } from "@/components/app/NavegacaoMesa";
import { SeletorImagem } from "@/components/app/perfil/Foto";
import { Seletor } from "@/components/ui/Seletor";
import { DESCRICAO_NIVEL, ROTULO_NIVEL, niveisConcedidos, type Nivel } from "@/lib/auth/niveis";
import { ROTULO_ACAO } from "@/lib/escritorio/rotulos";
import { alterar, agora, euDe, nomeDe, novoId, useDemo, type PessoaDemo } from "./estado";
import { useAviso } from "./PerfilDemo";

type Aba = "pessoas" | "convidar" | "configuracoes" | "auditoria" | "plano";
const quando = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const ordem = (i: number) => ({ "--i": i }) as CSSProperties;
const ROTULOS: Record<string, string> = { ...ROTULO_ACAO, perfil: "Atualizou o perfil", caso_criado: "Criou um caso", consulta: "Fez uma consulta" };

export function EscritorioDemo() {
  const e = useDemo();
  const [aba, setAba] = useState<Aba>("pessoas");
  const [aviso, avisar] = useAviso();
  if (!e) return null;
  const eu = euDe(e);
  const ativos = e.pessoas.filter((p) => p.situacao === "ativo");

  return (
    <>
      <Cabeca trilha={`${e.escritorio.nome} / Escritório`} titulo="Administração do escritório" descricao={`${ativos.length} ${ativos.length === 1 ? "pessoa ativa" : "pessoas ativas"} · você é ${ROTULO_NIVEL[eu.nivel]}`}>
        <DockSecoes
          rotulo="Seções da administração"
          atual={aba}
          muda={setAba}
          itens={[
            { id: "pessoas", nome: "Pessoas" },
            { id: "convidar", nome: "Convidar" },
            { id: "configuracoes", nome: "Configurações" },
            { id: "auditoria", nome: "Auditoria" },
            { id: "plano", nome: "Plano" },
          ]}
        />
      </Cabeca>
      {aviso && <p className="alerta info mesa-entra" role="status">{aviso}</p>}

      {aba === "pessoas" && (
        <section className="bloco" key="pessoas">
          <ul className="mesa-pessoas">
            {e.pessoas.map((p, i) => (
              <Pessoa key={p.id} p={p} eu={eu} i={i} avisar={avisar} />
            ))}
          </ul>
          <p className="mesa-nota">
            Ninguém muda o próprio nível. Um Administrador não promove ninguém acima de si nem age sobre outro Administrador; o Titular só muda
            por transferência.
          </p>
        </section>
      )}

      {aba === "convidar" && <Convidar avisar={avisar} irPessoas={() => setAba("pessoas")} />}
      {aba === "configuracoes" && <Configuracoes avisar={avisar} />}

      {aba === "auditoria" && (
        <div className="tabela-envolve mesa-entra" key="aud">
          <table className="tabela">
            <thead>
              <tr><th>Quando</th><th className="esq">Quem</th><th className="esq">O quê</th><th className="esq">Detalhe</th></tr>
            </thead>
            <tbody>
              {e.auditoria.map((a) => (
                <tr key={a.id}>
                  <td>{quando(a.em)}</td>
                  <td className="esq">{nomeDe(e, a.quem)}</td>
                  <td className="esq">{ROTULOS[a.acao] ?? a.acao}</td>
                  <td className="esq"><small>{a.detalhe}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === "plano" && (
        <div className="mesa-coluna" key="plano">
          <div className="mesa-numeros">
            <div className="mesa-numero mesa-entra">
              <span>Plano</span>
              <strong>Escritório</strong>
              <span>R$ 249 por pessoa, por mês</span>
            </div>
            <div className="mesa-numero mesa-entra" style={ordem(1)}>
              <span>Assentos em uso</span>
              <strong>{e.pessoas.filter((p) => p.situacao !== "suspenso").length}</strong>
              <span>Pessoas ativas e convites pendentes. Suspensos não contam.</span>
            </div>
          </div>
          <p className="alerta aviso mesa-entra" style={ordem(2)}>
            Na demonstração não há cobrança. No app, o Titular assina pelo Stripe, e convidar alguém acima dos assentos pede a confirmação
            dele, com valor proporcional.
          </p>
        </div>
      )}
    </>
  );
}

function Pessoa({ p, eu, i, avisar }: { p: PessoaDemo; eu: PessoaDemo; i: number; avisar: (m: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const proprio = p.id === eu.id;
  const alcancavel = !proprio && p.nivel !== "titular" && (eu.nivel === "titular" || p.nivel !== "admin");
  const mudar = (fn: (x: PessoaDemo) => void, acao: string, detalhe: string, msg: string) => {
    alterar((x) => {
      fn(x.pessoas.find((q) => q.id === p.id)!);
      return x;
    }, acao, detalhe);
    avisar(msg);
  };
  return (
    <li className="mesa-pessoa mesa-entra" style={ordem(i)} data-suspensa={p.situacao === "suspenso" ? "" : undefined}>
      <span className="mesa-pessoa-quem">
        <Avatar nome={p.nome} />
        <span>
          <strong>
            {p.nome}
            {proprio ? " (você)" : ""}
          </strong>
          <small>
            {p.cargo || "Sem cargo"}
            {p.email ? ` · ${p.email}` : ""}
          </small>
        </span>
      </span>
      <span className="mesa-pessoa-info">
        <span className={`selo nivel-${p.nivel}`}>{ROTULO_NIVEL[p.nivel]}</span>
        {p.situacao === "convidado" && <span className="selo em_revisao">Convite pendente</span>}
        {p.situacao === "suspenso" && <span className="selo bloqueada">Suspenso</span>}
      </span>
      {alcancavel ? (
        <button type="button" className="mesa-pessoa-gerir" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          {aberto ? "Fechar" : "Gerir"}
        </button>
      ) : (
        <span />
      )}
      {alcancavel && aberto && (
        <div className="mesa-pessoa-acoes">
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              const n = String(new FormData(ev.currentTarget).get("nivel")) as Nivel;
              if (n !== p.nivel) mudar((x) => (x.nivel = n), "mudanca_nivel", `${p.nome}: ${ROTULO_NIVEL[p.nivel]} → ${ROTULO_NIVEL[n]}`, `Nível alterado para ${ROTULO_NIVEL[n]}.`);
            }}
          >
            <div className="campo">
              <label htmlFor={`n-${p.id}`}>Nível</label>
              <Seletor key={p.nivel} id={`n-${p.id}`} name="nivel" defaultValue={p.nivel} opcoes={niveisConcedidos(eu.nivel).map((n) => ({ valor: n, rotulo: ROTULO_NIVEL[n] }))} />
            </div>
            <p className="mesa-nota">{DESCRICAO_NIVEL[p.nivel]}</p>
            <div className="mesa-form-pe"><button className="mesa-botao">Mudar nível</button></div>
          </form>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              const c = String(new FormData(ev.currentTarget).get("cargo") ?? "").trim();
              mudar((x) => (x.cargo = c), "configuracao", `Cargo de ${p.nome}: ${c || "sem cargo"}`, "Cargo salvo.");
            }}
          >
            <div className="campo">
              <label htmlFor={`c-${p.id}`}>Cargo</label>
              <input id={`c-${p.id}`} name="cargo" defaultValue={p.cargo} maxLength={80} />
            </div>
            <div className="mesa-form-pe"><button className="mesa-botao">Salvar cargo</button></div>
          </form>
          {p.situacao === "convidado" ? (
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                mudar((x) => (x.situacao = "ativo"), "aceite_convite", p.email, `${p.nome} aceitou o convite (simulado).`);
              }}
            >
              <p className="mesa-nota">No app, o convite vai por e-mail e vale 7 dias. Aqui, simule o aceite.</p>
              <div className="mesa-form-pe"><button className="mesa-botao secundario">Simular aceite</button></div>
            </form>
          ) : (
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                const suspender = p.situacao !== "suspenso";
                mudar((x) => (x.situacao = suspender ? "suspenso" : "ativo"), suspender ? "suspensao" : "reativacao", p.nome, suspender ? "Acesso suspenso." : "Acesso reativado.");
              }}
            >
              <p className="mesa-nota">{p.situacao === "suspenso" ? "Volta a entrar e a contar como assento." : "Sai na hora e deixa de contar como assento. Nada é apagado."}</p>
              <div className="mesa-form-pe"><button className="mesa-botao secundario">{p.situacao === "suspenso" ? "Reativar" : "Suspender"}</button></div>
            </form>
          )}
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              alterar((x) => ({ ...x, pessoas: x.pessoas.filter((q) => q.id !== p.id), casos: x.casos.map((c) => ({ ...c, incluidos: c.incluidos.filter((id) => id !== p.id) })) }), "remocao", p.nome);
              avisar(`${p.nome} saiu do escritório. As consultas ficam com o escritório.`);
            }}
          >
            <p className="mesa-nota">O vínculo acaba; a conta continua da pessoa e as consultas ficam com o escritório.</p>
            <div className="mesa-form-pe"><button className="mesa-botao perigo">{p.situacao === "convidado" ? "Cancelar convite" : "Remover"}</button></div>
          </form>
        </div>
      )}
    </li>
  );
}

function Convidar({ avisar, irPessoas }: { avisar: (m: string) => void; irPessoas: () => void }) {
  const e = useDemo()!;
  const eu = euDe(e);
  const [erro, setErro] = useState<string | null>(null);
  const pendentes = e.pessoas.filter((p) => p.situacao === "convidado");
  const enviar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const email = String(f.get("email") ?? "").trim().toLowerCase();
    const nome = String(f.get("nome") ?? "").trim();
    const nivel = String(f.get("nivel")) as Nivel;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErro("Informe um e-mail válido.");
    if (e.pessoas.some((p) => p.email === email)) return setErro("Esta pessoa já está no escritório.");
    alterar(
      (x) => ({ ...x, pessoas: [...x.pessoas, { id: novoId(), nome: nome || email.split("@")[0], email, cargo: String(f.get("cargo") ?? "").trim(), nivel, situacao: "convidado", desde: agora() }] }),
      "convite",
      `${email} como ${ROTULO_NIVEL[nivel]}`,
    );
    avisar(`Convite criado para ${email}. No app, ele sai por e-mail e vale 7 dias.`);
    irPessoas();
  };
  return (
    <div className="mesa-grade-2 convidar-grade">
    <form className="mesa-cartao mesa-entra" onSubmit={enviar} noValidate>
      <h2>Convidar pessoa</h2>
      <p>O link vale por 7 dias, serve uma vez e só para o e-mail convidado.</p>
      {erro && <p className="alerta erro" role="alert">{erro}</p>}
      <div className="duas-col">
        <div className="campo">
          <label htmlFor="cv-email">E-mail</label>
          <input id="cv-email" name="email" type="email" autoComplete="off" />
        </div>
        <div className="campo">
          <label htmlFor="cv-nome">Nome (opcional)</label>
          <input id="cv-nome" name="nome" />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="cv-cargo">Cargo (opcional)</label>
        <input id="cv-cargo" name="cargo" placeholder="Associada, Paralegal…" />
      </div>
      <fieldset className="mesa-escolhas">
        <legend>Nível de acesso</legend>
        {niveisConcedidos(eu.nivel).map((n) => (
          <label key={n} className="mesa-escolha">
            <input type="radio" name="nivel" value={n} defaultChecked={n === "membro"} />
            <span>
              {ROTULO_NIVEL[n]}
              <small>{DESCRICAO_NIVEL[n]}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mesa-form-pe"><button className="mesa-botao">Enviar convite</button></div>
    </form>
    <aside className="mesa-cartao mesa-entra convidar-lado" style={{ "--i": 1 } as CSSProperties}>
      <h2>Convites pendentes</h2>
      {pendentes.length === 0 ? (
        <p className="mesa-vazio-cartao">Nenhum convite aguardando resposta.</p>
      ) : (
        <ul className="inicio-lista">
          {pendentes.map((p) => (
            <li key={p.id}>
              <span>{p.email}</span>
              <small>{ROTULO_NIVEL[p.nivel]} · enviado em {new Date(p.desde).toLocaleDateString("pt-BR")}</small>
            </li>
          ))}
        </ul>
      )}
      <h2 className="convidar-sub">Como funciona</h2>
      <ol className="convidar-passos">
        <li><strong>O convite sai por e-mail.</strong> O link vale 7 dias e só abre com o e-mail convidado.</li>
        <li><strong>A pessoa cria a senha.</strong> Se o escritório exigir, ativa a verificação em duas etapas.</li>
        <li><strong>O acesso segue o nível.</strong> Você pode mudar o nível ou suspender a qualquer momento, em Pessoas.</li>
      </ol>
    </aside>
    </div>
  );
}

function Configuracoes({ avisar }: { avisar: (m: string) => void }) {
  const e = useDemo()!;
  const [exige, setExige] = useState(e.escritorio.exige2fa);
  const enviar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const nome = String(f.get("nome") ?? "").trim();
    if (nome.length < 2) return avisar("Informe o nome do escritório.");
    alterar(
      (x) => ({ ...x, escritorio: { ...x.escritorio, nome, exige2fa: exige, sessaoHoras: Number(f.get("sessao")), dominio: String(f.get("dominio") ?? "").trim().toLowerCase() } }),
      "configuracao",
      "Nome, 2FA, sessão ou domínio",
    );
    avisar("Configurações salvas.");
  };
  return (
    <div className="mesa-grade-2" key="cfg">
      <form className="mesa-cartao mesa-entra" onSubmit={enviar} noValidate>
        <h2>Configurações</h2>
        <div className="campo">
          <label htmlFor="cf-nome">Nome do escritório</label>
          <input id="cf-nome" name="nome" defaultValue={e.escritorio.nome} />
        </div>
        <fieldset className="mesa-escolhas">
          <legend>Verificação em duas etapas</legend>
          {(
            [
              ["nao", "Opcional", "Cada pessoa decide."],
              ["admins", "Obrigatória para Administradores e Titular", "Quem gere pessoas e dados ativa antes de continuar."],
              ["todos", "Obrigatória para todos", "Ninguém entra sem o código do aplicativo."],
            ] as const
          ).map(([v, t, sub]) => (
            <label key={v} className="mesa-escolha">
              <input type="radio" checked={exige === v} onChange={() => setExige(v)} />
              <span>{t}<small>{sub}</small></span>
            </label>
          ))}
        </fieldset>
        <div className="duas-col">
          <div className="campo">
            <label htmlFor="cf-sessao">Tempo da sessão</label>
            <Seletor
              id="cf-sessao"
              name="sessao"
              defaultValue={String(e.escritorio.sessaoHoras)}
              opcoes={[[8, "8 horas"], [24, "1 dia"], [72, "3 dias"], [168, "7 dias"], [336, "14 dias"], [720, "30 dias"]].map(([h, t]) => ({ valor: String(h), rotulo: String(t) }))}
            />
          </div>
          <div className="campo">
            <label htmlFor="cf-dominio">Domínio de e-mail</label>
            <input id="cf-dominio" name="dominio" defaultValue={e.escritorio.dominio} placeholder="escritorio.adv.br" />
          </div>
        </div>
        <div className="mesa-form-pe"><button className="mesa-botao">Salvar configurações</button></div>
      </form>
      <div className="mesa-cartao mesa-entra" style={ordem(1)}>
        <h2>Logo</h2>
        <p>Vai no cabeçalho do parecer exportado.</p>
        <SeletorImagem
          atual={e.escritorio.logo}
          nome={e.escritorio.nome}
          quadrada={false}
          lado={480}
          rotulo="logo"
          salvar={async (logo) => {
            alterar((x) => ({ ...x, escritorio: { ...x.escritorio, logo } }), "configuracao", logo ? "Logo enviado" : "Logo removido");
            return { ok: logo ? "Logo salvo." : "Logo removido." };
          }}
        />
      </div>
    </div>
  );
}
