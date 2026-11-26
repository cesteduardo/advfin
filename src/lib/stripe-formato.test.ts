import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { conferirWebhook, formulario } from "./stripe-formato";

describe("Stripe: formato e webhook", () => {
  it("monta o formulário aninhado como a API espera", () => {
    expect(formulario({ mode: "subscription", line_items: [{ price: "price_1", quantity: 3 }], metadata: { escritorio_id: "x" }, vazio: undefined }).join("&")).toBe(
      "mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=3&metadata%5Bescritorio_id%5D=x",
    );
  });

  it("aceita a assinatura certa e recusa corpo alterado, segredo errado ou horário velho", () => {
    const corpo = '{"type":"customer.subscription.updated"}';
    const t = 1_800_000_000;
    const v1 = createHmac("sha256", "whsec_teste").update(`${t}.${corpo}`).digest("hex");
    const cab = `t=${t},v1=${v1}`;
    expect(conferirWebhook(corpo, cab, "whsec_teste", t * 1000)).toBe(true);
    expect(conferirWebhook(corpo + " ", cab, "whsec_teste", t * 1000)).toBe(false);
    expect(conferirWebhook(corpo, cab, "whsec_outro", t * 1000)).toBe(false);
    expect(conferirWebhook(corpo, cab, "whsec_teste", (t + 600) * 1000)).toBe(false);
    expect(conferirWebhook(corpo, null, "whsec_teste", t * 1000)).toBe(false);
  });
});
