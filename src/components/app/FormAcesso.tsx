"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cadastrar, entrar, type EstadoForm } from "@/lib/auth/acoes";

export function FormEntrar() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(entrar, {});
  return (
    <form action={acao} className="painel" noValidate>
      <h2>Entrar</h2>
      <p className="lead">Pesquisa, cálculo e classificação da Reforma, com a fonte ao lado.</p>
      {estado.erro && <p className="alerta erro" role="alert">{estado.erro}</p>}
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={estado.email} />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      <button className="botao" disabled={pendente}>{pendente ? "Entrando…" : "Entrar"}</button>
      <p className="acesso-troca">
        Ainda não tem conta? <Link href="/cadastro">Criar conta do escritório</Link>
      </p>
    </form>
  );
}

export function FormCadastro() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(cadastrar, {});
  return (
    <form action={acao} className="painel" noValidate>
      <h2>Criar conta</h2>
      <p className="lead">Você entra como sócio do escritório e pode convidar a equipe depois.</p>
      {estado.erro && <p className="alerta erro" role="alert">{estado.erro}</p>}
      <div className="campo">
        <label htmlFor="nome">Seu nome</label>
        <input id="nome" name="nome" autoComplete="name" required />
      </div>
      <div className="campo">
        <label htmlFor="email">E-mail profissional</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={estado.email} />
      </div>
      <div className="campo">
        <label htmlFor="escritorio">Escritório</label>
        <input id="escritorio" name="escritorio" autoComplete="organization" required />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={10} required aria-describedby="senha-ajuda" />
        <span className="ajuda" id="senha-ajuda">Ao menos 10 caracteres.</span>
      </div>
      <label className="caixa-aceite">
        <input type="checkbox" name="aceite" required />
        <span>
          Li e aceito os <a href="#termos">Termos de Uso</a> e a <a href="#privacidade">Política de Privacidade</a>. Os dados dos
          meus clientes não treinam modelos de IA.
        </span>
      </label>
      <button className="botao" disabled={pendente}>{pendente ? "Criando…" : "Criar conta"}</button>
      <p className="acesso-troca">
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </form>
  );
}
