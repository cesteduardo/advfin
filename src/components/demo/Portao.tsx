"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Seletor } from "@/components/ui/Seletor";
import { Simbolo } from "@/components/app/Marca";
import { criarDemo, useDemo } from "./estado";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

/**
 * Na primeira visita, antes de tudo, a pessoa cria o próprio perfil e o do escritório e entra
 * como Titular. Depois disso, a demonstração abre direto, com os dados guardados no navegador.
 */
export function Portao({ children }: { children: ReactNode }) {
  const e = useDemo();
  if (e === undefined) return <div className="demo-carregando" aria-hidden="true" />;
  if (e === null) return <Cadastro />;
  return <>{children}</>;
}

function Cadastro() {
  const [erro, setErro] = useState<string | null>(null);
  const enviar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    if (v("nome").length < 2) return setErro("Informe o seu nome.");
    if (v("escritorio").length < 2) return setErro("Informe o nome do escritório.");
    if (v("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email"))) return setErro("Revise o e-mail.");
    criarDemo({
      nome: v("nome"),
      email: v("email").toLowerCase(),
      cargo: v("cargo"),
      oab: v("oab"),
      uf: v("uf"),
      escritorio: v("escritorio"),
      dominio: v("email").split("@")[1]?.toLowerCase() ?? "",
      exemplo: f.get("exemplo") === "on",
    });
  };
  return (
    <div className="demo-cadastro mesa-entra">
      <form className="mesa-cartao" onSubmit={enviar} noValidate>
        <p className="mesa-autor">
          <Simbolo /> AdvFin · demonstração
        </p>
        <h2>Crie o seu perfil e o do escritório</h2>
        <p>Você entra como Titular, com acesso de administrador a tudo: pessoas, casos, configurações e auditoria. Fica salvo só neste navegador.</p>
        {erro && <p className="alerta erro" role="alert">{erro}</p>}
        <p className="mesa-rotulo">Você</p>
        <div className="duas-col">
          <div className="campo">
            <label htmlFor="d-nome">Nome</label>
            <input id="d-nome" name="nome" autoComplete="name" required />
          </div>
          <div className="campo">
            <label htmlFor="d-cargo">Cargo</label>
            <input id="d-cargo" name="cargo" placeholder="Sócio, Gestora…" />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="d-email">E-mail profissional</label>
          <input id="d-email" name="email" type="email" autoComplete="email" />
        </div>
        <div className="duas-col">
          <div className="campo">
            <label htmlFor="d-oab">OAB (opcional)</label>
            <input id="d-oab" name="oab" inputMode="numeric" />
          </div>
          <div className="campo">
            <label htmlFor="d-uf">UF</label>
            <Seletor id="d-uf" name="uf" defaultValue="" opcoes={[{ valor: "", rotulo: "—" }, ...UFS.map((u) => ({ valor: u, rotulo: u }))]} />
          </div>
        </div>
        <p className="mesa-rotulo">Escritório</p>
        <div className="campo">
          <label htmlFor="d-escritorio">Nome do escritório</label>
          <input id="d-escritorio" name="escritorio" autoComplete="organization" required />
        </div>
        <label className="mesa-escolha">
          <input type="checkbox" name="exemplo" defaultChecked />
          <span>
            Incluir uma equipe de exemplo
            <small>Três pessoas fictícias, uma de cada nível, para ver pessoas, níveis e casos funcionando.</small>
          </span>
        </label>
        <div className="mesa-form-pe">
          <button className="mesa-botao">Criar e entrar</button>
        </div>
      </form>
    </div>
  );
}
