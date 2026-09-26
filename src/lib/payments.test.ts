import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { cardProvider, nowpaymentsCardCurrency, nowpaymentsCheckout, paymentOptions, verifyNowpayments } from "./payments.server.ts";

const KEYS = [
  "NOWPAYMENTS_API_KEY",
  "NOWPAYMENTS_IPN_SECRET",
  "NOWPAYMENTS_CARD",
  "NOWPAYMENTS_CARD_MIN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
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
