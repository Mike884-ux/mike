/**
 * Checkout with payment providers — **server-only**. No SDKs: plain HTTPS.
 *
 * - NOWPayments (crypto: USDT, BTC, ETH, …) — NOWPAYMENTS_API_KEY + NOWPAYMENTS_IPN_SECRET.
 * - Bank cards, whichever is set up first:
 *   - Stripe — STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET (not available in every country);
 *   - Dodo Payments (merchant of record, works for sellers in Tajikistan) —
 *     DODO_API_KEY, then one click in /admin creates the product (one-time,
 *     "pay what you want": the site sets each checkout's price) and the
 *     webhook, and saves their ids and the signing secret in the database.
 *     DODO_PRODUCT_ID / DODO_WEBHOOK_SECRET, when set, win over the saved ones.
 *     DODO_MODE=test uses Dodo's test environment;
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
/** Dodo product and webhook saved from /admin (per test/live mode). */
export type DodoStored = { productId?: string; webhookId?: string; webhookSecret?: string; webhookUrl?: string };
export type DodoConfig = { apiKey: string; productId: string; webhookSecret: string };

export const dodoMode = (): "test" | "live" => (env("DODO_MODE").toLowerCase() === "test" ? "test" : "live");

/** Everything a Dodo checkout needs, or null while something is missing. Env values win. */
export function resolveDodo(stored: DodoStored = {}): DodoConfig | null {
  const apiKey = env("DODO_API_KEY");
  const productId = env("DODO_PRODUCT_ID") || stored.productId || "";
  const webhookSecret = env("DODO_WEBHOOK_SECRET") || stored.webhookSecret || "";
  return apiKey && productId && webhookSecret ? { apiKey, productId, webhookSecret } : null;
}

export type CardProvider = "stripe" | "dodo" | "nowpayments";

/** Who takes a card payment: Stripe, then Dodo Payments, then NOWPayments' card on-ramp. */
export function cardProvider(stored?: DodoStored): CardProvider | null {
  if (hasStripe()) return "stripe";
  if (resolveDodo(stored)) return "dodo";
  return hasNowpayments() && nowpaymentsCardCurrency() ? "nowpayments" : null;
}

export function paymentOptions(stored?: DodoStored): PaymentOptions {
  const card = cardProvider(stored);
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

const dodoBase = () => (dodoMode() === "test" ? "https://test.dodopayments.com" : "https://live.dodopayments.com");

async function dodoApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${dodoBase()}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${env("DODO_API_KEY")}`, "Content-Type": "application/json" },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new DodoError(res.status, data.message ?? "");
  return data;
}

export class DodoError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(`dodo ${status}: ${detail}`);
    this.status = status;
  }
}

const DODO_EVENTS = ["payment.succeeded", "payment.failed", "payment.cancelled"];

/**
 * One-click setup from /admin: creates the site's product (one-time, "pay what
 * you want" from $5, tax included) and a webhook to `webhookUrl` unless the
 * saved ones already fit, and returns what to save.
 */
export async function connectDodo(webhookUrl: string, stored: DodoStored = {}): Promise<Required<DodoStored>> {
  let productId = stored.productId ?? "";
  if (!productId) {
    const product = await dodoApi<{ product_id?: string }>("/products", {
      method: "POST",
      body: {
        name: "Skan subscription",
        description: "Skan Pro / Whale access for a month or a year (one-time payment, no auto-renewal).",
        tax_category: "saas",
        price: {
          type: "one_time_price",
          currency: "USD",
          price: 500,
          discount: 0,
          pay_what_you_want: true,
          suggested_price: 900,
          purchasing_power_parity: false,
          tax_inclusive: true,
        },
      },
    });
    if (!product.product_id) throw new DodoError(0, "no product_id");
    productId = product.product_id;
  }
  let webhookId = stored.webhookId ?? "";
  let webhookSecret = stored.webhookSecret ?? "";
  if (!webhookSecret || stored.webhookUrl !== webhookUrl) {
    const hook = await dodoApi<{ id?: string }>("/webhooks", {
      method: "POST",
      body: { url: webhookUrl, description: "Skan site", filter_types: DODO_EVENTS },
    });
    if (!hook.id) throw new DodoError(0, "no webhook id");
    webhookId = hook.id;
    webhookSecret = (await dodoApi<{ secret?: string }>(`/webhooks/${encodeURIComponent(hook.id)}/secret`)).secret ?? "";
    if (!webhookSecret) throw new DodoError(0, "no webhook secret");
  }
  return { productId, webhookId, webhookSecret, webhookUrl };
}

/** Saved Dodo settings for the current mode (cached for a minute; /admin refreshes it). */
let storedCache: { at: number; mode: string; value: DodoStored } | null = null;

export const dodoKeys = (mode = dodoMode()) => ({
  productId: `dodo:${mode}:product_id`,
  webhookId: `dodo:${mode}:webhook_id`,
  webhookSecret: `dodo:${mode}:webhook_secret`,
  webhookUrl: `dodo:${mode}:webhook_url`,
});

export async function storedDodo(fresh = false): Promise<DodoStored> {
  if (!env("DODO_API_KEY")) return {};
  const mode = dodoMode();
  if (!fresh && storedCache && storedCache.mode === mode && Date.now() - storedCache.at < 60_000) return storedCache.value;
  try {
    const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
    const keys = dodoKeys(mode);
    const row = await store.getSettings(await getSql(), Object.values(keys));
    const value: DodoStored = {
      productId: row[keys.productId],
      webhookId: row[keys.webhookId],
      webhookSecret: row[keys.webhookSecret],
      webhookUrl: row[keys.webhookUrl],
    };
    storedCache = { at: Date.now(), mode, value };
    return value;
  } catch (err) {
    console.error("[billing] could not read Dodo settings:", err);
    return {};
  }
}

/**
 * Dodo Payments checkout session for one plan: the one-time product is "pay
 * what you want", so the site sets the price; payment_id travels in metadata.
 */
export async function dodoCheckout(input: CheckoutInput, config: DodoConfig): Promise<{ url: string; externalId: string }> {
  const res = await fetch(`${dodoBase()}/checkouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      product_cart: [{ product_id: config.productId, quantity: 1, amount: Math.round(input.amount * 100) }],
      ...(input.email ? { customer: { email: input.email, name: input.email.split("@")[0] || input.email } } : {}),
      billing_currency: "USD",
      return_url: `${input.origin}/pricing?paid=1`,
      metadata: { payment_id: input.paymentId, plan: `${PLAN_LABEL[input.plan]} ${input.period}` },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { session_id?: string; checkout_url?: string | null; message?: string };
  if (!res.ok || !data.checkout_url) throw new Error(`dodo ${res.status}: ${data.message ?? ""}`);
  return { url: data.checkout_url, externalId: data.session_id ?? "" };
}

/**
 * Dodo signs webhooks the Standard Webhooks way: HMAC-SHA256 over
 * "id.timestamp.body" with the base64 secret after "whsec_", sent as
 * "v1,<base64>" (several may be space-separated); stale messages are refused.
 */
export function verifyDodo(
  raw: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  now = Date.now(),
  secret = env("DODO_WEBHOOK_SECRET"),
): WebhookResult {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return null;
  const ts = Number.parseInt(headers.timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return null;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (!key.length) return null;
  const expected = createHmac("sha256", key).update(`${headers.id}.${ts}.${raw}`).digest();
  const valid = headers.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!valid) return null;
  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return null;
  }
  const data = event.data ?? {};
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const paymentId = String(metadata.payment_id ?? "");
  // Amounts come in cents; the site asks for USD, so anything else skips the price check.
  const cents = Number(data.total_amount);
  const amount = String(data.currency ?? "").toUpperCase() === "USD" && Number.isFinite(cents) ? cents / 100 : null;
  if (event.type === "payment.succeeded") return { paymentId, paid: true, failed: false, amount };
  if (event.type === "payment.failed" || event.type === "payment.cancelled") return { paymentId, paid: false, failed: true, amount };
  return { paymentId, paid: false, failed: false, amount };
}
