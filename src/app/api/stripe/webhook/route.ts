import { consultar } from "@/lib/db";
import { conferirWebhook, planoDoPreco } from "@/lib/stripe";

/**
 * Eventos do Stripe. Só a assinatura muda no banco, e só por aqui: o checkout e o portal
 * acontecem no Stripe, e o estado volta neste webhook (assinatura conferida pelo segredo).
 */
export async function POST(req: Request) {
  const segredo = process.env.STRIPE_WEBHOOK_SEGREDO;
  if (!segredo) return new Response("webhook não configurado", { status: 503 });
  const corpo = await req.text();
  if (!conferirWebhook(corpo, req.headers.get("stripe-signature"), segredo)) return new Response("assinatura inválida", { status: 400 });

  const evento = JSON.parse(corpo);
  if (typeof evento?.type === "string" && evento.type.startsWith("customer.subscription.")) {
    const a = evento.data.object;
    const item = a.items?.data?.[0];
    const status = evento.type === "customer.subscription.deleted" ? "canceled" : a.status;
    await consultar(`select app.stripe_sincronizar($1, $2, $3, $4, $5)`, [
      a.customer,
      a.id,
      status,
      item?.quantity ?? 1,
      item?.price?.id ? planoDoPreco(item.price.id) : null,
    ]);
  }
  return Response.json({ recebido: true });
}
