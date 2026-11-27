"use client";

import { useState, useTransition } from "react";
import { confirmar2fa, desativar2fa, gerarNovosCodigos, iniciar2fa } from "@/lib/perfil/acoes";
import { Codigos, FormAcao, type ResultadoAcao } from "../FormAcao";

/**
 * Verificação em duas etapas por aplicativo (Google Authenticator, 1Password, Authy...).
 * Ativar: QR code, código para conferir, e os códigos de recuperação mostrados uma vez.
 */
export function DoisFatores({ ativo, restantes, obrigatorio }: { ativo: boolean; restantes: number; obrigatorio: boolean }) {
  const [qr, setQr] = useState<{ erro?: string; segredo?: string; uri?: string; qr?: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  // Os códigos ficam aqui, e não no formulário: ao ativar, a página se atualiza e o
  // formulário de ativação sai de cena, mas os códigos precisam continuar à vista.
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const guardando = (acao: (e: ResultadoAcao, f: FormData) => Promise<ResultadoAcao>) => async (e: ResultadoAcao, f: FormData) => {
    const r = await acao(e, f);
    if (r.codigos) setCodigos(r.codigos);
    return { ...r, codigos: undefined };
  };
  const aviso = codigos && <Codigos codigos={codigos} />;

  if (ativo) {
    return (
      <div className="mesa-cartao">
        <h2>Verificação em duas etapas</h2>
        {aviso}
        <p>
          <span className="selo publicado">Ativa</span> No login, depois da senha, o AdvFin pede o código do aplicativo.{" "}
          {restantes} {restantes === 1 ? "código de recuperação restante" : "códigos de recuperação restantes"}.
        </p>
        <div className="mesa-grade-2">
          <FormAcao acao={guardando(gerarNovosCodigos)} botao="Gerar códigos novos" pendente="Gerando…" classe="mesa-sub" secundario>
            <div className="campo">
              <label htmlFor="senha-codigos">Senha, para gerar códigos de recuperação novos</label>
              <input id="senha-codigos" name="senha" type="password" autoComplete="current-password" required />
            </div>
          </FormAcao>
          {!obrigatorio && (
            <FormAcao acao={desativar2fa} botao="Desativar" pendente="Desativando…" classe="mesa-sub" perigo>
              <div className="campo">
                <label htmlFor="senha-desativar">Senha, para desativar</label>
                <input id="senha-desativar" name="senha" type="password" autoComplete="current-password" required />
              </div>
            </FormAcao>
          )}
        </div>
        {obrigatorio && <p className="mesa-nota">O escritório exige a verificação para o seu nível, então ela não pode ser desligada.</p>}
      </div>
    );
  }

  return (
    <div className="mesa-cartao">
      <h2>Verificação em duas etapas</h2>
      <p>Além da senha, o login pede um código de 6 dígitos de um aplicativo no seu celular. Quem descobrir a senha não entra sem ele.</p>
      {!qr?.qr && (
        <div className="mesa-form-pe inicio">
          <button type="button" className="mesa-botao" disabled={pendente} onClick={() => iniciar(async () => setQr(await iniciar2fa()))}>
            {pendente ? "Preparando…" : "Ativar"}
          </button>
        </div>
      )}
      {qr?.erro && <p className="alerta erro" role="alert">{qr.erro}</p>}
      {qr?.qr && (
        <>
          <div className="mesa-qr">
            <div dangerouslySetInnerHTML={{ __html: qr.qr }} role="img" aria-label="QR code para o aplicativo autenticador" />
            <div>
              <p className="mesa-nota">1. Abra o aplicativo autenticador e leia o QR code.</p>
              <p className="mesa-nota">
                Sem câmera? Digite a chave: <code>{qr.segredo}</code>
              </p>
              <p className="mesa-nota">
                No celular, <a href={qr.uri}>abra direto no aplicativo</a>.
              </p>
            </div>
          </div>
          <FormAcao acao={guardando(confirmar2fa)} botao="Confirmar e ativar" pendente="Conferindo…" classe="mesa-sub">
            <div className="campo">
              <label htmlFor="codigo-2fa">2. Digite o código que o aplicativo mostra</label>
              <input id="codigo-2fa" name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required />
            </div>
          </FormAcao>
        </>
      )}
    </div>
  );
}
