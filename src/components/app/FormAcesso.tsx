"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { cadastrar, cadastrarPorConvite, consultarDominio, entrar, verificarSegundoFator, type EstadoForm } from "@/lib/auth/acoes";

function Mensagens({ estado }: { estado: EstadoForm }) {
  return (
    <>
      {estado.erro && <p className="alerta erro" role="alert">{estado.erro}</p>}
      {estado.aviso && <p className="alerta info" role="status">{estado.aviso}</p>}
    </>
  );
}

export function FormEntrar({ volta, convite, emailFixo, aviso }: { volta?: string; convite?: string; emailFixo?: string; aviso?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(entrar, {});
  return (
    <form action={acao} className="painel" noValidate>
      <h2>Entrar</h2>
      <p className="lead">{convite ? "Entre com a sua conta para aceitar o convite." : "Pesquisa, cálculo e classificação da Reforma, com a fonte ao lado."}</p>
      {aviso && !estado.erro && !estado.aviso && <p className="alerta info" role="status">{aviso}</p>}
      <Mensagens estado={estado} />
      {volta && <input type="hidden" name="volta" value={volta} />}
      {convite && <input type="hidden" name="convite" value={convite} />}
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={emailFixo ?? estado.email} readOnly={Boolean(emailFixo)} />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      <button className="botao" disabled={pendente}>{pendente ? "Entrando…" : "Entrar"}</button>
      {!convite && (
        <p className="acesso-troca">
          Ainda não tem conta? <Link href="/cadastro">Criar conta do escritório</Link>
        </p>
      )}
    </form>
  );
}

/** Segundo passo do login: código do aplicativo, ou um código de recuperação. */
export function FormVerificar({ volta }: { volta?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(verificarSegundoFator, {});
  const [recuperacao, setRecuperacao] = useState(false);
  return (
    <form action={acao} className="painel" noValidate>
      <h2>Verificação em duas etapas</h2>
      <p className="lead">
        {recuperacao ? "Digite um dos códigos de recuperação que você guardou. Cada um vale uma vez." : "Digite o código de 6 dígitos que o aplicativo autenticador mostra agora."}
      </p>
      <Mensagens estado={estado} />
      {volta && <input type="hidden" name="volta" value={volta} />}
      <input type="hidden" name="modo" value={recuperacao ? "recuperacao" : "codigo"} />
      <div className="campo">
        <label htmlFor="codigo">{recuperacao ? "Código de recuperação" : "Código"}</label>
        <input
          key={recuperacao ? "r" : "c"}
          id="codigo"
          name="codigo"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode={recuperacao ? "text" : "numeric"}
          maxLength={recuperacao ? 12 : 7}
          placeholder={recuperacao ? "XXXX-XXXX" : "000000"}
        />
      </div>
      <button className="botao" disabled={pendente}>{pendente ? "Conferindo…" : "Confirmar"}</button>
      <p className="acesso-troca">
        <button type="button" className="link-botao" onClick={() => setRecuperacao(!recuperacao)}>
          {recuperacao ? "Usar o código do aplicativo" : "Perdi o celular: usar um código de recuperação"}
        </button>
      </p>
    </form>
  );
}

export function FormCadastro() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(cadastrar, {});
  const [dominio, setDominio] = useState<{ id: string; nome: string } | null>(null);
  const [entrada, setEntrada] = useState(true);
  const pedir = Boolean(dominio && entrada);
  return (
    <form action={acao} className="painel" noValidate>
      <h2>Criar conta</h2>
      <p className="lead">Você entra como Titular do escritório e pode convidar a equipe depois.</p>
      <Mensagens estado={estado} />
      <div className="campo">
        <label htmlFor="nome">Seu nome</label>
        <input id="nome" name="nome" autoComplete="name" required />
      </div>
      <div className="campo">
        <label htmlFor="email">E-mail profissional</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={estado.email}
          onBlur={(e) => consultarDominio(e.currentTarget.value).then(setDominio).catch(() => setDominio(null))}
        />
      </div>
      {dominio && (
        <fieldset className="campo escolha-dominio">
          <legend>
            O seu e-mail é do domínio de <strong>{dominio.nome}</strong>, que já usa o AdvFin.
          </legend>
          <label className="caixa-aceite">
            <input type="radio" name="destino" checked={entrada} onChange={() => setEntrada(true)} />
            <span>Pedir para entrar em {dominio.nome} (um administrador aprova)</span>
          </label>
          <label className="caixa-aceite">
            <input type="radio" name="destino" checked={!entrada} onChange={() => setEntrada(false)} />
            <span>Criar um escritório novo</span>
          </label>
          {pedir && <input type="hidden" name="entrada" value={dominio.id} />}
        </fieldset>
      )}
      {!pedir && (
        <div className="campo">
          <label htmlFor="escritorio">Escritório</label>
          <input id="escritorio" name="escritorio" autoComplete="organization" required />
        </div>
      )}
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={10} required aria-describedby="senha-ajuda" />
        <span className="ajuda" id="senha-ajuda">Ao menos 10 caracteres.</span>
      </div>
      <Aceite />
      <button className="botao" disabled={pendente}>{pendente ? "Criando…" : pedir ? "Criar conta e pedir entrada" : "Criar conta"}</button>
      <p className="acesso-troca">
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </form>
  );
}

function Aceite() {
  return (
    <label className="caixa-aceite">
      <input type="checkbox" name="aceite" required />
      <span>
        Li e aceito os{" "}
        <a href="/termos" target="_blank" rel="noopener">
          Termos de Uso
        </a>{" "}
        e a{" "}
        <a href="/privacidade" target="_blank" rel="noopener">
          Política de Privacidade
        </a>
        . Declaro que uso o AdvFin como profissional, que ele não substitui a minha análise e que os dados dos meus clientes não
        treinam modelos de IA.
      </span>
    </label>
  );
}

/** Quem foi convidado e ainda não tem conta: o e-mail vem do convite. */
export function FormCadastroConvite({ convite, email, escritorio }: { convite: string; email: string; escritorio: string }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(cadastrarPorConvite, {});
  return (
    <form action={acao} className="painel" noValidate>
      <h2>Criar conta</h2>
      <p className="lead">Você entra direto em {escritorio}.</p>
      <Mensagens estado={estado} />
      <input type="hidden" name="convite" value={convite} />
      <div className="campo">
        <label htmlFor="email-convite">E-mail</label>
        <input id="email-convite" type="email" value={email} readOnly />
      </div>
      <div className="campo">
        <label htmlFor="nome">Seu nome</label>
        <input id="nome" name="nome" autoComplete="name" required />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={10} required aria-describedby="senha-ajuda" />
        <span className="ajuda" id="senha-ajuda">Ao menos 10 caracteres.</span>
      </div>
      <Aceite />
      <button className="botao" disabled={pendente}>{pendente ? "Criando…" : "Criar conta e entrar"}</button>
    </form>
  );
}
