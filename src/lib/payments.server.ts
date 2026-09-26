/**
 * Checkout with payment providers — **server-only**. No SDKs: plain HTTPS.
 *
 * - NOWPayments (crypto: USDT, BTC, ETH, …) — NOWPAYMENTS_API_KEY + NOWPAYMENTS_IPN_SECRET.
 * - Bank cards, either way:
 *   - Stripe — STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET (not available in every country);
 *   - NOWPayments' card on-ramp (Guardarian): the customer pays by card and the
 *     owner receives crypto — NOWPAYMENTS_CARD=usd once NOWPayments has turned
 *     it on for the account. Its card partner has a minimum (NOWPAYMENTS_CARD_MIN, $20).
 *
 * All are one-time payments for a month or a year, so nothing renews behind
 * the member's back; the webhook grants the plan once the money arrives.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { PLAN_LABEL, type PaidPlan, type Period, type PaymentOptions } from "./plans.ts";

const env = (name: string) => process.env[name]?.trim() || "";

const DEFAULT_CARD_MIN = 20;

/** The fiat currency NOWPayments charges cards in, or null when its card on-ramp is off. */
export function nowpaymentsCardCurrency(): string | null {
  const value = env("NOWPAYMENTS_CARD").toLowerCase();
  if (!value || /^(0|no|off|false)$/.test(value)) return null;
  if (/^(1|yes|on|true)$/.test(value)) return "usd";
  return /^[a-z]{3}$/.test(value) ? value : "usd";
}

function cardMinimum(): number {
  const raw = env("NOWPAYMENTS_CARD_MIN");
  const min = raw ? Number(raw) : NaN;
  return Number.isFinite(min) && min >= 0 ? min : DEFAULT_CARD_MIN;
}

const hasNowpayments = () => Boolean(env("NOWPAYMENTS_API_KEY") && env("NOWPAYMENTS_IPN_SECRET"));
const hasStripe = () => Boolean(env("STRIPE_SECRET_KEY") && env("STRIPE_WEBHOOK_SECRET"));

/** Who takes a card payment: Stripe when it is set up, otherwise NOWPayments' card on-ramp. */
export function cardProvider(): "stripe" | "nowpayments" | null {
  if (hasStripe()) return "stripe";
  return hasNowpayments() && nowpaymentsCardCurrency() ? "nowpayments" : null;
}

export function paymentOptions(): PaymentOptions {
  const card = cardProvider();
  return {
    crypto: hasNowpayments(),
    card: card !== null,
    cardMin: card === "nowpayments" ? cardMinimum() : null,
    contact: env("PAY_CONTACT") || null,
  };
}

export type CheckoutInput = {
  paymentId: string;
  plan: PaidPlan;
  period: Period;
  amount: number;
  email: string;
  origin: string;
};

function title(plan: PaidPlan, period: Period): string {
  return `Скан ${PLAN_LABEL[plan]} — ${period === "year" ? "1 год / 1 year" : "1 месяц / 1 month"}`;
}

/**
 * NOWPayments invoice. With `payCurrency` set to a fiat ticker ("usd") the
 * invoice opens straight on the card payment of its on-ramp partner.
 */
export async function nowpaymentsCheckout(
  input: CheckoutInput,
  payCurrency?: string | null,
): Promise<{ url: string; externalId: string }> {
  const res = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: { "x-api-key": env("NOWPAYMENTS_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: input.amount,
      price_currency: "usd",
      ...(payCurrency ? { pay_currency: payCurrency } : {}),
      order_id: input.paymentId,
      // Plain ASCII: the IPN signature is checked over this text re-serialized.
      order_description: `Skan ${PLAN_LABEL[input.plan]} - ${input.period === "year" ? "1 year" : "1 month"}`,
      ipn_callback_url: `${input.origin}/api/billing/nowpayments`,
      success_url: `${input.origin}/pricing?paid=1`,
      cancel_url: `${input.origin}/pricing?canceled=1`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string | number;
    invoice_url?: string;
    message?: string;
  };
  if (!res.ok || !data.invoice_url)
    throw new Error(`nowpayments ${res.status}: ${data.message ?? ""}`);
  return { url: data.invoice_url, externalId: String(data.id ?? "") };
}

/** NOWPayments signs the IPN body with HMAC-SHA512 over its JSON with keys sorted, nested ones too. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** NOWPayments' own Node example, which also turns arrays into index-keyed objects. */
function sortKeysLikeDocs(value: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((out, key) => {
      const item = value[key];
      out[key] = item && typeof item === "object" ? sortKeysLikeDocs(item as Record<string, unknown>) : item;
      return out;
    }, {});
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

export type WebhookResult = {
  paymentId: string;
  paid: boolean;
  failed: boolean;
  amount: number | null;
} | null;

export function verifyNowpayments(raw: string, signature: string | null): WebhookResult {
  const secret = env("NOWPAYMENTS_IPN_SECRET");
  if (!secret || !signature) return null;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const given = signature.trim().toLowerCase();
  const signed = new Set([JSON.stringify(sortKeys(body)), JSON.stringify(sortKeysLikeDocs(body))]);
  const valid = [...signed].some((text) => safeEqualHex(createHmac("sha512", secret).update(text).digest("hex"), given));
  if (!valid) return null;
  const status = String(body.payment_status ?? "");
  const amount = Number(body.price_amount);
  return {
    paymentId: String(body.order_id ?? ""),
    paid: status === "finished",
    failed: status === "failed" || status === "expired" || status === "refunded",
    amount: Number.isFinite(amount) ? amount : null,
  };
}

export async function stripeCheckout(
  input: CheckoutInput,
): Promise<{ url: string; externalId: string }> {
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${input.origin}/pricing?paid=1`,
    cancel_url: `${input.origin}/pricing?canceled=1`,
    client_reference_id: input.paymentId,
    "metadata[payment_id]": input.paymentId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(input.amount * 100)),
    "line_items[0][price_data][product_data][name]": title(input.plan, input.period),
  });
  if (input.email) form.set("customer_email", input.email);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.url) throw new Error(`stripe ${res.status}: ${data.error?.message ?? ""}`);
  return { url: data.url, externalId: data.id ?? "" };
}

/** Stripe-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">; rejects stale events. */
export function verifyStripe(raw: string, header: string | null, now = Date.now()): WebhookResult {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret || !header) return null;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const signatures = header
    .split(",")
    .filter((kv) => kv.trim().startsWith("v1="))
    .map((kv) => kv.trim().slice(3));
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 600 || !signatures.length) return null;
  const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  if (!signatures.some((sig) => safeEqualHex(expected, sig))) return null;
  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return null;
  }
  const obj = event.data?.object ?? {};
  const metadata = (obj.metadata ?? {}) as Record<string, unknown>;
  const paymentId = String(metadata.payment_id ?? obj.client_reference_id ?? "");
  const amount = typeof obj.amount_total === "number" ? obj.amount_total / 100 : null;
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    return { paymentId, paid: obj.payment_status === "paid", failed: false, amount };
  }
  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    return { paymentId, paid: false, failed: true, amount };
  }
  return { paymentId, paid: false, failed: false, amount };
}
