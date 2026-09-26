/**
 * Checkout with payment providers — **server-only**. No SDKs: plain HTTPS.
 *
 * - NOWPayments (crypto: USDT, BTC, ETH, …) — NOWPAYMENTS_API_KEY + NOWPAYMENTS_IPN_SECRET.
 * - Stripe (bank cards) — STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET.
 *
 * Both are one-time payments for a month or a year, so nothing renews behind
 * the member's back; the webhook grants the plan once the money arrives.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaidPlan, Period, PaymentOptions } from "./plans";

const env = (name: string) => process.env[name]?.trim() || "";

export function paymentOptions(): PaymentOptions {
  return {
    crypto: Boolean(env("NOWPAYMENTS_API_KEY") && env("NOWPAYMENTS_IPN_SECRET")),
    card: Boolean(env("STRIPE_SECRET_KEY") && env("STRIPE_WEBHOOK_SECRET")),
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
  return `Скан ${plan === "max" ? "Max" : "Pro"} — ${period === "year" ? "1 год / 1 year" : "1 месяц / 1 month"}`;
}

export async function nowpaymentsCheckout(
  input: CheckoutInput,
): Promise<{ url: string; externalId: string }> {
  const res = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: { "x-api-key": env("NOWPAYMENTS_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: input.amount,
      price_currency: "usd",
      order_id: input.paymentId,
      order_description: title(input.plan, input.period),
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

/** NOWPayments signs the IPN body with HMAC-SHA512 over its JSON with keys sorted. */
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
  const expected = createHmac("sha512", secret)
    .update(JSON.stringify(sortKeys(body)))
    .digest("hex");
  if (!safeEqualHex(expected, signature.trim().toLowerCase())) return null;
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
