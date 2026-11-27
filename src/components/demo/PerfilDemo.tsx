"use client";

import { DockSecoes } from "@/components/app/DockSecoes";
import { useState, type FormEvent } from "react";
import { Cabeca } from "@/components/app/Cabeca";
import { SeletorImagem } from "@/components/app/perfil/Foto";
import { CampoData } from "@/components/ui/CampoData";
import { Seletor } from "@/components/ui/Seletor";
import { ROTULO_NIVEL } from "@/lib/auth/niveis";
import { alterar, apagarDemo, euDe, useDemo } from "./estado";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

/** Confirmação que some sozinha depois de alguns segundos. */
export function useAviso() {
  const [msg, setMsg] = useState<string | null>(null);
  const mostrar = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg((x) => (x === m ? null : x)), 3200);
  };
  return [msg, mostrar] as const;
}

export function PerfilDemo() {
  const e = useDemo();
  const [aba, setAba] = useState<"dados" | "preferencias" | "demo">("dados");
  const [aviso, avisar] = useAviso();
  const [modo, setModo] = useState<"hoje" | "data" | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  if (!e) return null;
  const eu = euDe(e);
  const vigModo = modo ?? (e.perfil.vigencia === "hoje" ? "hoje" : "data");

  const salvarDados = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    if (v("nome").length < 2) return avisar("Informe um nome com ao menos 2 letras.");
    alterar((x) => {
      const p = x.pessoas.find((p) => p.id === x.eu)!;
      p.nome = v("nome");
      p.cargo = v("cargo");
      p.email = v("email").toLowerCase();
      x.perfil.oab = v("oab");
      x.perfil.uf = v("uf");
      return x;
    }, "perfil", "Dados do perfil atualizados");
    avisar("Dados salvos.");
  };
  const salvarPreferencias = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const data = String(f.get("vigencia_data") ?? "");
    if (vigModo === "data" && !data) return avisar("Escolha a data fixa de vigência.");
    alterar((x) => ({ ...x, perfil: { ...x.perfil, vigencia: vigModo === "data" ? data : "hoje" } }));
    avisar("Preferências salvas.");
  };
  const baixar = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "advfin-demonstracao.json" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Cabeca trilha={`${e.escritorio.nome} / Perfil`} titulo={eu.nome} descricao={`${ROTULO_NIVEL[eu.nivel]}${eu.cargo ? ` · ${eu.cargo}` : ""}${eu.email ? ` · ${eu.email}` : ""}`}>
        <DockSecoes
          rotulo="Seções do perfil"
          atual={aba}
          muda={setAba}
          itens={[
            { id: "dados", nome: "Dados" },
            { id: "preferencias", nome: "Preferências" },
            { id: "demo", nome: "Dados da demonstração" },
          ]}
        />
      </Cabeca>
      {aviso && <p className="alerta info mesa-entra" role="status">{aviso}</p>}

      {aba === "dados" && (
        <div className="mesa-grade-2" key="dados">
          <div className="mesa-cartao mesa-entra">
            <h2>Foto</h2>
            <SeletorImagem
              atual={e.perfil.foto}
              nome={eu.nome}
              rotulo="foto"
              salvar={async (foto) => {
                alterar((x) => ({ ...x, perfil: { ...x.perfil, foto } }));
                return { ok: foto ? "Foto atualizada." : "Foto removida." };
              }}
            />
          </div>
          <form className="mesa-cartao mesa-entra" style={{ "--i": 1 } as React.CSSProperties} onSubmit={salvarDados} noValidate>
            <h2>Dados</h2>
            <div className="campo">
              <label htmlFor="p-nome">Nome</label>
              <input id="p-nome" name="nome" defaultValue={eu.nome} />
            </div>
            <div className="campo">
              <label htmlFor="p-cargo">Cargo em {e.escritorio.nome}</label>
              <input id="p-cargo" name="cargo" defaultValue={eu.cargo} placeholder="Sócio, Associada, Paralegal…" />
              <span className="ajuda">Aparece no perfil e na assinatura do parecer. Não muda o que você pode fazer.</span>
            </div>
            <div className="campo">
              <label htmlFor="p-email">E-mail</label>
              <input id="p-email" name="email" type="email" defaultValue={eu.email} />
            </div>
            <div className="duas-col">
              <div className="campo">
                <label htmlFor="p-oab">OAB (número)</label>
                <input id="p-oab" name="oab" defaultValue={e.perfil.oab} inputMode="numeric" />
              </div>
              <div className="campo">
                <label htmlFor="p-uf">UF</label>
                <Seletor id="p-uf" name="uf" defaultValue={e.perfil.uf} opcoes={[{ valor: "", rotulo: "—" }, ...UFS.map((u) => ({ valor: u, rotulo: u }))]} />
              </div>
            </div>
            {e.perfil.oab && <p className="mesa-nota"><span className="selo em_revisao">OAB declarada; no app, a equipe AdvFin confere</span></p>}
            <div className="mesa-form-pe">
              <button className="mesa-botao">Salvar dados</button>
            </div>
          </form>
        </div>
      )}

      {aba === "preferencias" && (
        <form className="mesa-cartao mesa-entra" key="pref" onSubmit={salvarPreferencias} noValidate>
          <h2>Preferências</h2>
          <fieldset className="mesa-escolhas">
            <legend>Data de vigência que a pesquisa usa ao abrir</legend>
            <label className="mesa-escolha">
              <input type="radio" checked={vigModo === "hoje"} onChange={() => setModo("hoje")} />
              <span>Hoje<small>O que vale na data de cada consulta.</small></span>
            </label>
            <label className="mesa-escolha">
              <input type="radio" checked={vigModo === "data"} onChange={() => setModo("data")} />
              <span>
                Uma data fixa<small>Para quem trabalha casos de um período antigo.</small>
                <span style={{ display: "block", marginTop: 6, maxWidth: 220 }}>
                  <CampoData name="vigencia_data" min="2023-12-21" defaultValue={e.perfil.vigencia === "hoje" ? "" : e.perfil.vigencia} rotulo="Data fixa de vigência" />
                </span>
              </span>
            </label>
          </fieldset>
          <div className="mesa-form-pe">
            <button className="mesa-botao">Salvar preferências</button>
          </div>
        </form>
      )}

      {aba === "demo" && (
        <div className="mesa-grade-2" key="demo">
          <div className="mesa-cartao mesa-entra">
            <h2>Baixar os dados</h2>
            <p>Um arquivo JSON com tudo o que você criou na demonstração: perfil, escritório, pessoas, casos, consultas e auditoria.</p>
            <div className="mesa-form-pe inicio">
              <button type="button" className="mesa-botao" onClick={baixar}>Baixar JSON</button>
            </div>
          </div>
          <div className="mesa-cartao mesa-entra" style={{ "--i": 1 } as React.CSSProperties}>
            <h2>Recomeçar</h2>
            <p>Apaga o escritório da demonstração deste navegador e volta para o cadastro.</p>
            <div className="mesa-form-pe inicio">
              {confirmando ? (
                <>
                  <button type="button" className="mesa-botao perigo" onClick={apagarDemo}>Sim, apagar tudo</button>
                  <button type="button" className="mesa-botao secundario" onClick={() => setConfirmando(false)}>Cancelar</button>
                </>
              ) : (
                <button type="button" className="mesa-botao perigo" onClick={() => setConfirmando(true)}>Apagar e recomeçar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
