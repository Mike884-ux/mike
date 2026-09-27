import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  cardProvider,
  connectDodo,
  dodoCheckout,
  nowpaymentsCardCurrency,
  nowpaymentsCheckout,
  paymentOptions,
  resolveDodo,
  verifyDodo,
  verifyNowpayments,
} from "./payments.server.ts";

const KEYS = [
  "NOWPAYMENTS_API_KEY",
  "NOWPAYMENTS_IPN_SECRET",
  "NOWPAYMENTS_CARD",
  "NOWPAYMENTS_CARD_MIN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "DODO_API_KEY",
  "DODO_WEBHOOK_SECRET",
  "DODO_PRODUCT_ID",
  "DODO_MODE",
  "PAY_CONTACT",
] as const;

function withEnv<T>(values: Partial<Record<(typeof KEYS)[number], string>>, run: () => T): T {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
  try {
    return run();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const NOW = { NOWPAYMENTS_API_KEY: "key", NOWPAYMENTS_IPN_SECRET: "ipn-secret" };
const STRIPE = { STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec" };

test("payment options: crypto, cards through NOWPayments or Stripe, bank transfer", () => {
  withEnv({}, () => assert.deepEqual(paymentOptions(), { crypto: false, card: false, cardMin: null, contact: null }));
  withEnv({ ...NOW }, () => assert.deepEqual(paymentOptions(), { crypto: true, card: false, cardMin: null, contact: null }));
  withEnv({ ...NOW, NOWPAYMENTS_CARD: "usd" }, () => {
    assert.deepEqual(paymentOptions(), { crypto: true, card: true, cardMin: 20, contact: null });
    assert.equal(cardProvider(), "nowpayments");
  });
  withEnv({ ...NOW, NOWPAYMENTS_CARD: "EUR", NOWPAYMENTS_CARD_MIN: "25", PAY_CONTACT: "@owner" }, () => {
    assert.deepEqual(paymentOptions(), { crypto: true, card: true, cardMin: 25, contact: "@owner" });
    assert.equal(nowpaymentsCardCurrency(), "eur");
  });
  // Stripe takes cards when it is set up, with no minimum.
  withEnv({ ...NOW, ...STRIPE, NOWPAYMENTS_CARD: "usd" }, () => {
    assert.equal(cardProvider(), "stripe");
    assert.equal(paymentOptions().cardMin, null);
  });
  // The card switch alone does nothing without the NOWPayments keys; "off" turns it off.
  withEnv({ NOWPAYMENTS_CARD: "usd" }, () => assert.equal(paymentOptions().card, false));
  withEnv({ ...NOW, NOWPAYMENTS_CARD: "off" }, () => assert.equal(paymentOptions().card, false));
  withEnv({ ...NOW, NOWPAYMENTS_CARD: "yes" }, () => assert.equal(nowpaymentsCardCurrency(), "usd"));
});

/** NOWPayments' documented Node example (arrays become index-keyed objects). */
function sortLikeDocs(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      const value = obj[key];
      result[key] = value && typeof value === "object" ? sortLikeDocs(value as Record<string, unknown>) : value;
      return result;
    }, {});
}

/** Plain deep sorting that keeps arrays as arrays. */
function sortKeepArrays(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeepArrays);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortKeepArrays(obj[k])]));
  }
  return value;
}

const sign = (text: string, secret = "ipn-secret") => createHmac("sha512", secret).update(text).digest("hex");

const ipn = {
  payment_status: "finished",
  price_amount: 9,
  price_currency: "usd",
  order_id: "pay-1",
  order_description: "Skan Pro - 1 month",
  fee: { withdrawalFee: 0, serviceFee: 0.05, depositFee: 0, currency: "usdttrc20" },
  payment_id: 123,
  actually_paid: 9.1,
};

test("IPN: signed like NOWPayments' docs, nested fee included", () => {
  withEnv({ ...NOW }, () => {
    const raw = JSON.stringify(ipn);
    const result = verifyNowpayments(raw, sign(JSON.stringify(sortLikeDocs(ipn))));
    assert.deepEqual(result, { paymentId: "pay-1", paid: true, failed: false, amount: 9 });
    // Upper-case hex and spaces around it are fine.
    assert.ok(verifyNowpayments(raw, ` ${sign(JSON.stringify(sortLikeDocs(ipn))).toUpperCase()} `));
  });
});

test("IPN: forged, tampered or unsigned notifications are refused", () => {
  withEnv({ ...NOW }, () => {
    const good = sign(JSON.stringify(sortLikeDocs(ipn)));
    assert.equal(verifyNowpayments(JSON.stringify({ ...ipn, price_amount: 1 }), good), null);
    assert.equal(verifyNowpayments(JSON.stringify(ipn), sign(JSON.stringify(sortLikeDocs(ipn)), "other")), null);
    assert.equal(verifyNowpayments(JSON.stringify(ipn), null), null);
    assert.equal(verifyNowpayments("not json", good), null);
    assert.equal(verifyNowpayments("[1,2]", sign("[1,2]")), null);
  });
  withEnv({}, () => assert.equal(verifyNowpayments(JSON.stringify(ipn), sign(JSON.stringify(sortLikeDocs(ipn)))), null));
});

test("IPN: arrays verify whichever way NOWPayments serializes them", () => {
  withEnv({ ...NOW }, () => {
    const body = { ...ipn, payment_extra_ids: [{ b: 2, a: 1 }, 7] };
    const raw = JSON.stringify(body);
    const docs = JSON.stringify(sortLikeDocs(body));
    const plain = JSON.stringify(sortKeepArrays(body));
    assert.notEqual(docs, plain);
    assert.ok(verifyNowpayments(raw, sign(docs)));
    assert.ok(verifyNowpayments(raw, sign(plain)));
  });
});

test("IPN: expired and failed payments are reported as failed", () => {
  withEnv({ ...NOW }, () => {
    for (const status of ["expired", "failed", "refunded"]) {
      const body = { ...ipn, payment_status: status };
      const result = verifyNowpayments(JSON.stringify(body), sign(JSON.stringify(sortLikeDocs(body))));
      assert.equal(result?.paid, false);
      assert.equal(result?.failed, true);
    }
    const waiting = { ...ipn, payment_status: "partially_paid" };
    const result = verifyNowpayments(JSON.stringify(waiting), sign(JSON.stringify(sortLikeDocs(waiting))));
    assert.deepEqual([result?.paid, result?.failed], [false, false]);
  });
});

test("NOWPayments invoice: cards open on the fiat currency, text stays ASCII", async () => {
  const sent: { body: Record<string, unknown>; key: string | null }[] = [];
  const realFetch = globalThis.fetch;
  const savedKey = process.env.NOWPAYMENTS_API_KEY;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    sent.push({ body: JSON.parse(String(init?.body)), key: new Headers(init?.headers).get("x-api-key") });
    return new Response(JSON.stringify({ id: 42, invoice_url: "https://nowpayments.io/payment/?iid=42" }), { status: 200 });
  }) as typeof fetch;
  process.env.NOWPAYMENTS_API_KEY = "key";
  try {
    const input = { paymentId: "pay-1", plan: "max" as const, period: "year" as const, amount: 278, email: "a@b.c", origin: "https://skan.ai" };
    assert.deepEqual(await nowpaymentsCheckout(input), { url: "https://nowpayments.io/payment/?iid=42", externalId: "42" });
    await nowpaymentsCheckout(input, "usd");
  } finally {
    globalThis.fetch = realFetch;
    if (savedKey === undefined) delete process.env.NOWPAYMENTS_API_KEY;
    else process.env.NOWPAYMENTS_API_KEY = savedKey;
  }
  assert.deepEqual(sent.map((s) => s.key), ["key", "key"]);
  assert.equal("pay_currency" in sent[0].body, false);
  assert.equal(sent[1].body.pay_currency, "usd");
  assert.equal(sent[1].body.price_amount, 278);
  assert.equal(sent[1].body.ipn_callback_url, "https://skan.ai/api/billing/nowpayments");
  assert.match(String(sent[1].body.order_description), /^[\x20-\x7e]+$/);
  assert.equal(sent[1].body.order_description, "Skan Whale - 1 year");
});

const DODO_SECRET = `whsec_${Buffer.from("dodo-test-secret-0123456789").toString("base64")}`;
const DODO = { DODO_API_KEY: "dodo_key", DODO_WEBHOOK_SECRET: DODO_SECRET, DODO_PRODUCT_ID: "pdt_123" };

function signDodo(id: string, ts: number, body: string, secret = DODO_SECRET): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

test("cards go to Dodo when it is set up (after Stripe, before the NOWPayments on-ramp), no minimum", () => {
  withEnv({ ...DODO }, () => {
    assert.equal(cardProvider(), "dodo");
    assert.deepEqual(paymentOptions(), { crypto: false, card: true, cardMin: null, contact: null });
  });
  withEnv({ ...DODO, ...NOW, NOWPAYMENTS_CARD: "usd" }, () => assert.equal(cardProvider(), "dodo"));
  withEnv({ ...DODO, ...STRIPE }, () => assert.equal(cardProvider(), "stripe"));
  withEnv({ DODO_API_KEY: "k", DODO_WEBHOOK_SECRET: DODO_SECRET }, () => assert.equal(cardProvider(), null));
});

test("Dodo webhook: Standard Webhooks signature, payment.succeeded grants", () => {
  withEnv({ ...DODO }, () => {
    const now = 1_790_000_000_000;
    const ts = Math.floor(now / 1000);
    const body = JSON.stringify({
      business_id: "bus_1",
      type: "payment.succeeded",
      timestamp: "2026-09-27T10:00:00Z",
      data: { payload_type: "Payment", payment_id: "pay_dodo", total_amount: 900, currency: "USD", metadata: { payment_id: "pay-1" } },
    });
    const headers = { id: "msg_1", timestamp: String(ts), signature: signDodo("msg_1", ts, body) };
    assert.deepEqual(verifyDodo(body, headers, now), { paymentId: "pay-1", paid: true, failed: false, amount: 9 });
    // Several signatures, one of them right
    assert.ok(verifyDodo(body, { ...headers, signature: `v1,AAAA ${headers.signature}` }, now));
    // Forged, tampered, stale or unsigned
    assert.equal(verifyDodo(body, { ...headers, signature: signDodo("msg_1", ts, body, `whsec_${Buffer.from("other").toString("base64")}`) }, now), null);
    assert.equal(verifyDodo(body.replace("900", "100"), headers, now), null);
    assert.equal(verifyDodo(body, headers, now + 10 * 60_000), null);
    assert.equal(verifyDodo(body, { ...headers, signature: null }, now), null);
    // Other currency: no price check; failures reported
    const eur = body.replace('"USD"', '"EUR"');
    assert.equal(verifyDodo(eur, { ...headers, signature: signDodo("msg_1", ts, eur) }, now)?.amount, null);
    const failed = body.replace("payment.succeeded", "payment.failed");
    assert.deepEqual(verifyDodo(failed, { ...headers, signature: signDodo("msg_1", ts, failed) }, now), {
      paymentId: "pay-1",
      paid: false,
      failed: true,
      amount: 9,
    });
  });
});

test("Dodo checkout: price in cents on the pay-what-you-want product, payment id in metadata, test mode URL", async () => {
  const sent: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get("authorization") });
    return new Response(JSON.stringify({ session_id: "cks_1", checkout_url: "https://checkout.dodopayments.com/cks_1" }), { status: 200 });
  }) as typeof fetch;
  const saved = { ...process.env };
  Object.assign(process.env, DODO, { DODO_MODE: "test" });
  try {
    const input = { paymentId: "pay-1", plan: "pro" as const, period: "year" as const, amount: 86, email: "buyer@example.com", origin: "https://skan.ai" };
    const config = { apiKey: "dodo_key", productId: "pdt_123", webhookSecret: DODO_SECRET };
    assert.deepEqual(await dodoCheckout(input, config), { url: "https://checkout.dodopayments.com/cks_1", externalId: "cks_1" });
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(DODO).concat("DODO_MODE")) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
  assert.equal(sent[0].url, "https://test.dodopayments.com/checkouts");
  assert.equal(sent[0].auth, "Bearer dodo_key");
  assert.deepEqual(sent[0].body.product_cart, [{ product_id: "pdt_123", quantity: 1, amount: 8600 }]);
  assert.deepEqual(sent[0].body.metadata, { payment_id: "pay-1", plan: "Pro year" });
  assert.equal(sent[0].body.return_url, "https://skan.ai/pricing?paid=1");
  assert.deepEqual(sent[0].body.customer, { email: "buyer@example.com", name: "buyer" });
});

test("Dodo saved from /admin: the API key plus the saved product and secret turn cards on; env wins", () => {
  withEnv({ DODO_API_KEY: "k" }, () => {
    assert.equal(cardProvider({}), null);
    assert.equal(cardProvider({ productId: "pdt_saved", webhookSecret: DODO_SECRET }), "dodo");
    assert.deepEqual(resolveDodo({ productId: "pdt_saved", webhookSecret: DODO_SECRET }), {
      apiKey: "k",
      productId: "pdt_saved",
      webhookSecret: DODO_SECRET,
    });
  });
  withEnv({ DODO_API_KEY: "k", DODO_PRODUCT_ID: "pdt_env" }, () =>
    assert.equal(resolveDodo({ productId: "pdt_saved", webhookSecret: DODO_SECRET })?.productId, "pdt_env"),
  );
  withEnv({}, () => assert.equal(cardProvider({ productId: "pdt_saved", webhookSecret: DODO_SECRET }), null));
});

test("Dodo one-click connect: creates the product and webhook once, reuses them after", async () => {
  const calls: { method: string; url: string; body: Record<string, unknown> | null }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    const u = String(url);
    const out = u.endsWith("/products") ? { product_id: "pdt_new" } : u.endsWith("/webhooks") ? { id: "wh_1" } : { secret: "whsec_c2VjcmV0" };
    return new Response(JSON.stringify(out), { status: 200 });
  }) as typeof fetch;
  const saved = process.env.DODO_API_KEY;
  const savedMode = process.env.DODO_MODE;
  process.env.DODO_API_KEY = "k";
  process.env.DODO_MODE = "test";
  try {
    const url = "https://skan-dfbl.onrender.com/api/billing/dodo";
    const first = await connectDodo(url);
    assert.deepEqual(first, { productId: "pdt_new", webhookId: "wh_1", webhookSecret: "whsec_c2VjcmV0", webhookUrl: url });
    assert.deepEqual(
      calls.map((c) => `${c.method} ${c.url.replace("https://test.dodopayments.com", "")}`),
      ["POST /products", "POST /webhooks", "GET /webhooks/wh_1/secret"],
    );
    const price = calls[0].body?.price as Record<string, unknown>;
    assert.equal(price.pay_what_you_want, true);
    assert.equal(price.type, "one_time_price");
    assert.deepEqual(calls[1].body?.filter_types, ["payment.succeeded", "payment.failed", "payment.cancelled"]);
    calls.length = 0;
    assert.deepEqual(await connectDodo(url, first), first);
    assert.equal(calls.length, 0);
    // A new site address gets a new webhook, the product stays.
    await connectDodo("https://skan.ai/api/billing/dodo", first);
    assert.deepEqual(calls.map((c) => c.url.replace("https://test.dodopayments.com", "")), ["/webhooks", "/webhooks/wh_1/secret"]);
  } finally {
    globalThis.fetch = realFetch;
    if (saved === undefined) delete process.env.DODO_API_KEY;
    else process.env.DODO_API_KEY = saved;
    if (savedMode === undefined) delete process.env.DODO_MODE;
    else process.env.DODO_MODE = savedMode;
  }
});
