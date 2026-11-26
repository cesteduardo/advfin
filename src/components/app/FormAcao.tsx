"use client";

import { useActionState, useState, type ReactNode } from "react";

export interface ResultadoAcao {
  erro?: string;
  ok?: string;
  link?: string;
  codigos?: string[];
  confirmarAssento?: boolean;
  /** Valores para devolver aos campos depois de um erro (o React limpa o formulário ao enviar). */
  valores?: Record<string, string>;
}

/**
 * Formulário de uma ação do servidor com a resposta logo abaixo: erro em bordô, confirmação em
 * azul e, quando não há provedor de e-mail, o link para copiar. `children` recebe o estado para
 * campos que dependem da resposta (por exemplo, pedir a confirmação de um assento).
 */
export function FormAcao({
  acao,
  botao,
  pendente: rotuloPendente = "Salvando…",
  children,
  classe = "mesa-cartao",
  perigo,
  secundario,
  id,
}: {
  acao: (estado: ResultadoAcao, form: FormData) => Promise<ResultadoAcao>;
  botao: string;
  pendente?: string;
  children?: ReactNode | ((estado: ResultadoAcao) => ReactNode);
  classe?: string;
  perigo?: boolean;
  secundario?: boolean;
  id?: string;
}) {
  const [estado, enviar, pendente] = useActionState<ResultadoAcao, FormData>(acao, {});
  return (
    <form action={enviar} className={classe} id={id} noValidate>
      {typeof children === "function" ? children(estado) : children}
      <Resposta estado={estado} />
      <div className="mesa-form-pe">
        <button className={`mesa-botao${perigo ? " perigo" : ""}${secundario ? " secundario" : ""}`} disabled={pendente}>
          {pendente ? rotuloPendente : botao}
        </button>
      </div>
    </form>
  );
}

export function Resposta({ estado }: { estado: ResultadoAcao }) {
  return (
    <>
      {estado.erro && <p className="alerta erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="alerta info" role="status">{estado.ok}</p>}
      {estado.link && <LinkCopiavel link={estado.link} />}
      {estado.codigos && <Codigos codigos={estado.codigos} />}
    </>
  );
}

export function LinkCopiavel({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="mesa-link">
      <input readOnly value={link} aria-label="Link" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(link).then(() => setCopiado(true))}
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

/** Códigos de recuperação: aparecem uma vez, com a orientação de guardar fora do celular. */
export function Codigos({ codigos }: { codigos: string[] }) {
  const texto = codigos.join("\n");
  return (
    <div className="mesa-codigos">
      <p>
        <strong>Guarde estes códigos agora.</strong> Cada um vale uma vez, se você perder o celular. Eles não aparecem de novo.
      </p>
      <ol>
        {codigos.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="mesa-acoes">
        <button type="button" onClick={() => navigator.clipboard?.writeText(texto)}>Copiar</button>
        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Códigos de recuperação do AdvFin\n\n${texto}\n`)}`} download="advfin-codigos-de-recuperacao.txt">
          Baixar .txt
        </a>
      </div>
    </div>
  );
}
