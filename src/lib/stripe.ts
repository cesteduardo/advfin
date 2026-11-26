import "server-only";
import { formulario } from "./stripe-formato";

/**
 * Cobrança por pessoa (assento) no Stripe, pela API REST, sem SDK.
 * O Stripe guarda os cartões; o AdvFin guarda só os identificadores do cliente e da assinatura,
 * e a assinatura só muda no banco pelo webhook (app.stripe_sincronizar).
 *
 * Variáveis: STRIPE_CHAVE (sk_...), STRIPE_WEBHOOK_SEGREDO (whsec_...) e um preço por assento
 * para cada plano: STRIPE_PRECO_ESSENCIAL, STRIPE_PRECO_ESCRITORIO, STRIPE_PRECO_TRIBUTARIO_PRO.
 * Formas de pagamento e período de teste seguem em aberto (plano, seção 8); hoje: só cartão, sem teste.
 */
export const PLANOS = ["essencial", "escritorio", "tributario_pro"] as const;
export type Plano = (typeof PLANOS)[number];

export const ROTULO_PLANO: Record<string, string> = {
  essencial: "Essencial",
  escritorio: "Escritório",
  tributario_pro: "Tributário Pro",
  corporativo: "Corporativo",
};

export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_CHAVE);
}

export function precoDoPlano(p: Plano): string | undefined {
  return process.env[`STRIPE_PRECO_${p.toUpperCase()}`];
}

export function planoDoPreco(preco: string): Plano | null {
  return PLANOS.find((p) => precoDoPlano(p) === preco) ?? null;
}

async function stripe<T = any>(metodo: "GET" | "POST", caminho: string, corpo?: Record<string, unknown>, chaveIdem?: string): Promise<T> {
  const r = await fetch(`https://api.stripe.com/v1/${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_CHAVE}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(chaveIdem ? { "Idempotency-Key": chaveIdem } : {}),
    },
    body: corpo ? formulario(corpo).join("&") : undefined,
  });
  const j = await r.json();
  if (!r.ok) {
    console.error("stripe", r.status, j?.error?.message);
    throw new Error("stripe_falhou");
  }
  return j as T;
}

export const criarCliente = (escritorioId: string, nome: string, email: string) =>
  stripe<{ id: string }>("POST", "customers", { name: nome, email, metadata: { escritorio_id: escritorioId } }, `cliente-${escritorioId}`);

export const criarCheckout = (o: { cliente: string; plano: Plano; assentos: number; volta: string }) =>
  stripe<{ url: string }>("POST", "checkout/sessions", {
    mode: "subscription",
    customer: o.cliente,
    line_items: [{ price: precoDoPlano(o.plano), quantity: o.assentos }],
    payment_method_types: ["card"],
    locale: "pt-BR",
    success_url: `${o.volta}?aba=plano&ok=1`,
    cancel_url: `${o.volta}?aba=plano`,
  });

/** Portal do Stripe: cartão, faturas, troca e cancelamento do plano. */
export const criarPortal = (cliente: string, volta: string) =>
  stripe<{ url: string }>("POST", "billing_portal/sessions", { customer: cliente, return_url: `${volta}?aba=plano`, locale: "pt-BR" });

export const lerAssinatura = (id: string) =>
  stripe<{ id: string; status: string; items: { data: { id: string; quantity: number; price: { id: string } }[] } }>("GET", `subscriptions/${id}`);

export const listarFaturas = (cliente: string) =>
  stripe<{ data: { id: string; number: string | null; created: number; total: number; currency: string; status: string; hosted_invoice_url: string | null }[] }>(
    "GET",
    `invoices?customer=${encodeURIComponent(cliente)}&limit=12`,
  );

/** Muda os assentos com cobrança proporcional; o webhook traz o novo estado ao banco. */
export async function ajustarAssentos(assinatura: string, assentos: number): Promise<void> {
  const a = await lerAssinatura(assinatura);
  const item = a.items.data[0];
  await stripe("POST", `subscriptions/${assinatura}`, {
    items: [{ id: item.id, quantity: assentos }],
    proration_behavior: "create_prorations",
  });
}

export { conferirWebhook } from "./stripe-formato";
