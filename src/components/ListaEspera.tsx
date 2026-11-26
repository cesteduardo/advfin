"use client";

import { useId, useState } from "react";

/**
 * Destino das inscrições. No servidor Next, a rota própria (/api/lista-espera).
 * Na versão estática (GitHub Pages) não há servidor: usa NEXT_PUBLIC_LISTA_ESPERA_URL
 * (ex.: um formulário Formspree ou uma função serverless). Sem ela, o formulário avisa e não finge enviar.
 */
const DESTINO =
  process.env.NEXT_PUBLIC_LISTA_ESPERA_URL || (process.env.NEXT_PUBLIC_ESTATICO === "1" ? null : "/api/lista-espera");

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
        body: JSON.stringify({ ...dados, consentimento: dados.consentimento === "on", origem: "landing" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível registrar agora.");
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
          <option value="tributarista_pequeno">Tributarista autônomo ou em escritório de até 5 advogados</option>
          <option value="escritorio_medio">Escritório de 6 a 50 advogados</option>
          <option value="juridico_interno">Jurídico ou fiscal de empresa</option>
          <option value="contador">Contador ou consultor tributário</option>
        </select>
      </div>
      <input className="armadilha" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="check campo">
        <input name="consentimento" type="checkbox" required />
        <span>
          Autorizo o uso do meu e-mail para receber o convite do beta e o boletim, conforme a LGPD. Posso cancelar a
          qualquer momento.
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
