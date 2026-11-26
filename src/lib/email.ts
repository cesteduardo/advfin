import "server-only";

/**
 * E-mail transacional (convites, troca de e-mail). O provedor ainda está em aberto no plano;
 * a camada é pequena para trocar sem mexer nas telas.
 *  - EMAIL_PROVEDOR=resend com EMAIL_CHAVE: envia pela API do Resend.
 *  - sem provedor: não envia; registra no log do servidor e a tela mostra o link para copiar.
 * EMAIL_REMETENTE: por exemplo "AdvFin <nao-responda@advfin.com.br>".
 */
export interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
}

export function emailConfigurado(): boolean {
  return process.env.EMAIL_PROVEDOR === "resend" && Boolean(process.env.EMAIL_CHAVE);
}

/** Devolve true quando o e-mail saiu; false quando não há provedor (a tela mostra o link). */
export async function enviarEmail(m: Mensagem): Promise<boolean> {
  if (!emailConfigurado()) {
    if (process.env.NODE_ENV !== "production") console.info(`[e-mail não enviado: sem provedor] para ${m.para}: ${m.assunto}\n${m.texto}`);
    return false;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.EMAIL_CHAVE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_REMETENTE ?? "AdvFin <nao-responda@advfin.com.br>",
      to: [m.para],
      subject: m.assunto,
      text: m.texto,
    }),
  });
  if (!r.ok) {
    console.error("email", r.status, await r.text().catch(() => ""));
    throw new Error("email_falhou");
  }
  return true;
}

/** Endereço público do app, para montar links nos e-mails. */
export function urlPublica(caminho: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${caminho}`;
}

export function textoConvite(o: { escritorio: string; quem: string; nivel: string; link: string }): Mensagem["texto"] {
  return [
    `${o.quem} convidou você para o escritório ${o.escritorio} no AdvFin, com o nível ${o.nivel}.`,
    "",
    `Para aceitar, abra o link abaixo. Ele vale por 7 dias e serve uma vez.`,
    o.link,
    "",
    "Se você não esperava este convite, ignore este e-mail.",
  ].join("\n");
}

export function textoTrocaEmail(o: { link: string }): Mensagem["texto"] {
  return [
    "Recebemos um pedido para usar este endereço na sua conta do AdvFin.",
    "",
    "Para confirmar, abra o link abaixo. Ele vale por 24 horas.",
    o.link,
    "",
    "Se não foi você, ignore este e-mail: nada muda na conta.",
  ].join("\n");
}
