"use client";

import { useId, useState } from "react";
import { EMAIL_INSCRICOES, ROTULO_PERFIL } from "@/config/site";

/**
 * Destino das inscrições:
 *  - site estático (domínio próprio ou GitHub Pages): e-mail via FormSubmit;
 *  - servidor Next com banco: a rota própria /api/lista-espera;
 *  - NEXT_PUBLIC_LISTA_ESPERA_URL, se definida, tem prioridade sobre os dois.
 */
const ESTATICO = process.env.NEXT_PUBLIC_ESTATICO === "1";
const URL_PROPRIA = process.env.NEXT_PUBLIC_LISTA_ESPERA_URL;
const DESTINO =
  URL_PROPRIA ||
  (ESTATICO ? (EMAIL_INSCRICOES ? `https://formsubmit.co/ajax/${EMAIL_INSCRICOES}` : null) : "/api/lista-espera");
const POR_EMAIL = DESTINO?.startsWith("https://formsubmit.co/") ?? false;

function corpo(dados: Record<string, FormDataEntryValue>) {
  const consentimento = dados.consentimento === "on";
  if (!POR_EMAIL) return { ...dados, consentimento, origem: "landing" };
  const perfil = String(dados.perfil ?? "");
  return {
    Nome: dados.nome,
    "E-mail": dados.email,
    "Atua como": ROTULO_PERFIL[perfil] ?? perfil,
    "Consentimento LGPD": consentimento ? `Sim, em ${new Date().toLocaleString("pt-BR")}` : "Não",
    Origem: typeof window !== "undefined" ? window.location.href : "landing",
    _subject: `AdvFin · nova inscrição na lista de espera: ${dados.nome}`,
    _replyto: dados.email,
    _template: "table",
    _captcha: "false",
    _honey: dados.site ?? "",
  };
}

export function ListaEspera() {
  const id = useId();
  const [estado, setEstado] = useState<"ocioso" | "enviando" | "ok" | "erro">("ocioso");
  const [mensagem, setMensagem] = useState("");

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.currentTarget));
    if (!DESTINO) {
      setMensagem("As inscrições desta prévia ainda não estão conectadas. Em breve, a lista abre por aqui.");
      setEstado("erro");
      return;
    }
    setEstado("enviando");
    try {
      const r = await fetch(DESTINO, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(corpo(dados)),
      });
      const j = await r.json().catch(() => ({}));
      // FormSubmit responde 200 com success "false" quando recusa o envio.
      if (!r.ok || String(j.success) === "false") throw new Error(j.erro ?? "Não foi possível registrar agora. Tente em instantes.");
      setEstado("ok");
    } catch (err) {
      setMensagem((err as Error).message);
      setEstado("erro");
    }
  }

  if (estado === "ok") {
    return (
      <p className="sucesso" role="status">
        Inscrição registrada. Você receberá o convite do beta e o boletim “A Reforma em uma página”.
      </p>
    );
  }

  return (
    <form className="painel" onSubmit={enviar} noValidate={false}>
      <div className="campo">
        <label htmlFor={`${id}-nome`}>Nome</label>
        <input id={`${id}-nome`} name="nome" type="text" autoComplete="name" required maxLength={120} />
      </div>
      <div className="campo">
        <label htmlFor={`${id}-email`}>E-mail profissional</label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="email" required maxLength={200} />
      </div>
      <div className="campo">
        <label htmlFor={`${id}-perfil`}>Você atua como</label>
        <select id={`${id}-perfil`} name="perfil" defaultValue="tributarista_pequeno">
          <option value="tributarista_pequeno">Autônomo ou escritório de até 5 advogados</option>
          <option value="escritorio_medio">Escritório de 6 a 50 advogados</option>
          <option value="juridico_interno">Jurídico ou fiscal de empresa</option>
          <option value="contador">Contador ou consultor tributário</option>
        </select>
      </div>
      <input className="armadilha" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="check campo">
        <input name="consentimento" type="checkbox" required />
        <span>
          Autorizo o uso do meu e-mail para receber o convite do beta e o boletim, conforme a{" "}
          <a href="#privacidade">Política de Privacidade</a>. Posso cancelar a qualquer momento.
        </span>
      </label>
      <button className="botao" type="submit" disabled={estado === "enviando"}>
        {estado === "enviando" ? "Enviando…" : "Entrar na lista de espera"}
      </button>
      {estado === "erro" && (
        <p className="erro" role="alert" style={{ marginTop: 12 }}>
          {mensagem}
        </p>
      )}
    </form>
  );
}
