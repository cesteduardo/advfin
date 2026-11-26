"use client";

import { useId, useState } from "react";
import { DESCRICAO_NIVEL, ROTULO_NIVEL, niveisConcedidos, type Nivel } from "@/lib/auth/niveis";
import { mudarCargo, mudarNivel, remover, suspender } from "@/lib/escritorio/acoes";
import { FormAcao } from "../FormAcao";
import { Avatar } from "../NavegacaoMesa";

export interface PessoaLinha {
  usuario_id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  nivel: Nivel;
  foto_url: string | null;
  oab: string | null;
  oab_verificada: boolean;
  ultimo_acesso_em: string | null;
  totp_ativo: boolean | null;
  suspenso_em: string | null;
}

const quando = (d: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "nunca";

/**
 * Uma linha da lista de pessoas. As ações aparecem só quando cabem ao nível de quem vê;
 * o banco confere de novo (app.mudar_nivel, app.suspender, app.remover_membro).
 */
export function Pessoa({ p, eu, euId }: { p: PessoaLinha; eu: Nivel; euId: string }) {
  const proprio = p.usuario_id === euId;
  const alcancavel = !proprio && p.nivel !== "titular" && (eu === "titular" || p.nivel !== "admin");
  const [aberto, setAberto] = useState(false);
  const painel = useId();
  return (
    <li className="mesa-pessoa" data-suspensa={p.suspenso_em ? "" : undefined}>
      <span className="mesa-pessoa-quem">
        <Avatar nome={p.nome} foto={p.foto_url} />
        <span>
          <strong>
            {p.nome}
            {proprio ? " (você)" : ""}
          </strong>
          <small>
            {p.cargo ?? "Sem cargo"}
            {p.email ? ` · ${p.email}` : ""}
          </small>
        </span>
      </span>
      <span className="mesa-pessoa-info">
        <span className={`selo nivel-${p.nivel}`}>{ROTULO_NIVEL[p.nivel]}</span>
        {p.suspenso_em && <span className="selo bloqueada">Suspenso</span>}
        {p.totp_ativo === true && <span className="selo publicado">2FA</span>}
        {p.totp_ativo === false && <span className="selo neutro">Sem 2FA</span>}
        {p.oab && <span className={`selo ${p.oab_verificada ? "publicado" : "neutro"}`}>OAB {p.oab}</span>}
        <span>Último acesso {quando(p.ultimo_acesso_em)}</span>
      </span>
      {alcancavel ? (
        <button type="button" className="mesa-pessoa-gerir" aria-expanded={aberto} aria-controls={painel} onClick={() => setAberto(!aberto)}>
          {aberto ? "Fechar" : "Gerir"}
        </button>
      ) : (
        <span />
      )}
      {alcancavel && aberto && (
        <div className="mesa-pessoa-acoes" id={painel}>
          <FormAcao acao={mudarNivel} botao="Mudar nível" classe="">
            <input type="hidden" name="usuario" value={p.usuario_id} />
            <div className="campo">
              <label htmlFor={`nivel-${p.usuario_id}`}>Nível</label>
              {/* key: depois de salvar, o React restaura o formulário; remontar mostra o nível novo. */}
              <select key={p.nivel} id={`nivel-${p.usuario_id}`} name="nivel" defaultValue={p.nivel}>
                {niveisConcedidos(eu).map((n) => (
                  <option key={n} value={n}>
                    {ROTULO_NIVEL[n]}
                  </option>
                ))}
              </select>
            </div>
            <p className="mesa-nota">{DESCRICAO_NIVEL[p.nivel]}</p>
          </FormAcao>
          <FormAcao acao={mudarCargo} botao="Salvar cargo" classe="">
            <input type="hidden" name="usuario" value={p.usuario_id} />
            <div className="campo">
              <label htmlFor={`cargo-${p.usuario_id}`}>Cargo</label>
              <input key={p.cargo ?? ""} id={`cargo-${p.usuario_id}`} name="cargo" defaultValue={p.cargo ?? ""} maxLength={80} />
            </div>
          </FormAcao>
          <FormAcao acao={suspender} botao={p.suspenso_em ? "Reativar" : "Suspender"} classe="" secundario>
            <input type="hidden" name="usuario" value={p.usuario_id} />
            <input type="hidden" name="suspender" value={p.suspenso_em ? "0" : "1"} />
            <p className="mesa-nota">
              {p.suspenso_em ? "Volta a entrar e a contar como assento." : "Sai de todas as sessões na hora e deixa de contar como assento. Nada é apagado."}
            </p>
          </FormAcao>
          <FormAcao acao={remover} botao="Remover do escritório" classe="" perigo>
            <input type="hidden" name="usuario" value={p.usuario_id} />
            <p className="mesa-nota">O vínculo acaba; a conta continua da pessoa e as consultas ficam com o escritório.</p>
          </FormAcao>
        </div>
      )}
    </li>
  );
}
