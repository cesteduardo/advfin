import { createHmac, timingSafeEqual } from "node:crypto";

/* Partes puras da integração com o Stripe, testadas sem rede. */

/** Corpo application/x-www-form-urlencoded no formato do Stripe (a[b][0][c]=...). */
export function formulario(obj: Record<string, unknown>, prefixo = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const chave = prefixo ? `${prefixo}[${k}]` : k;
    if (v === undefined || v === null) return [];
    if (Array.isArray(v)) return v.flatMap((x, i) => (typeof x === "object" ? formulario(x, `${chave}[${i}]`) : [`${encodeURIComponent(`${chave}[${i}]`)}=${encodeURIComponent(String(x))}`]));
    if (typeof v === "object") return formulario(v as Record<string, unknown>, chave);
    return [`${encodeURIComponent(chave)}=${encodeURIComponent(String(v))}`];
  });
}

/** Confere a assinatura Stripe-Signature (t=...,v1=...) com tolerância de 5 minutos. */
export function conferirWebhook(corpo: string, cabecalho: string | null, segredo: string, agora = Date.now()): boolean {
  if (!cabecalho) return false;
  const partes = Object.fromEntries(cabecalho.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(partes.t);
  if (!t || Math.abs(agora / 1000 - t) > 300) return false;
  const esperado = createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex");
  return cabecalho
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) => {
      const v = Buffer.from(p.slice(3));
      return v.length === esperado.length && timingSafeEqual(v, Buffer.from(esperado));
    });
}
