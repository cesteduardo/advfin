"use client";

import { DESCRICAO_NIVEL, ROTULO_NIVEL, niveisConcedidos, type Nivel } from "@/lib/auth/niveis";
import { convidar } from "@/lib/escritorio/acoes";
import { FormAcao } from "../FormAcao";

/** Convite por e-mail, com nível e cargo já escolhidos. Acima dos assentos, o Titular confirma aqui mesmo. */
export function Convidar({ eu, titular, valorAssento }: { eu: Nivel; titular: boolean; valorAssento: string | null }) {
  const niveis = niveisConcedidos(eu);
  return (
    <FormAcao acao={convidar} botao="Enviar convite" pendente="Convidando…">
      {(estado) => (
        <>
          <h2>Convidar pessoa</h2>
          <p>O link vale por 7 dias, serve uma vez e só para o e-mail convidado.</p>
          <div className="duas-col">
            <div className="campo">
              <label htmlFor="convite-email">E-mail</label>
              <input id="convite-email" name="email" type="email" autoComplete="off" required defaultValue={estado.valores?.email} />
            </div>
            <div className="campo">
              <label htmlFor="convite-cargo">Cargo (opcional)</label>
              <input id="convite-cargo" name="cargo" placeholder="Associada, Paralegal…" maxLength={80} defaultValue={estado.valores?.cargo} />
            </div>
          </div>
          <fieldset className="mesa-escolhas">
            <legend>Nível de acesso</legend>
            {niveis.map((n) => (
              <label key={n} className="mesa-escolha">
                <input type="radio" name="nivel" value={n} defaultChecked={n === (estado.valores?.nivel ?? "membro")} required />
                <span>
                  {ROTULO_NIVEL[n]}
                  <small>{DESCRICAO_NIVEL[n]}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {estado.confirmarAssento && titular && (
            <label className="caixa-aceite">
              <input type="checkbox" name="confirmar_assento" />
              <span>
                Incluir mais um assento na assinatura{valorAssento ? ` (${valorAssento} por mês, cobrado proporcionalmente neste ciclo)` : ", com cobrança proporcional neste ciclo"}.
              </span>
            </label>
          )}
          {!titular && (
            <p className="mesa-nota">Se não houver assento livre no plano, o convite fica guardado até o Titular confirmar mais um.</p>
          )}
        </>
      )}
    </FormAcao>
  );
}
