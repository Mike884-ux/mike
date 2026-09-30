import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ExchangeRefs } from "./exchanges";
import { asPaidPlan, asPeriod, PLAN_LABEL, PLANS, priceOf, STAR_PRICES, type Billing, type PaymentOptions } from "./plans";

/** The member's plan, today's AI usage and referral info. */
export const getBilling = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Billing> => {
    const [{ getSql }, store, { isAdminEmail }] = await Promise.all([
      import("./db"),
      import("./billing-store.server"),
      import("./quota.server"),
    ]);
    const sql = await getSql();
    const state = await store.loadPlan(sql, context.userId);
    const [used, referrals] = await Promise.all([
      store.usageToday(sql, context.userId),
      store.referralCount(sql, context.userId),
    ]);
    return {
      plan: state.plan,
      until: state.until,
      trial: state.trial,
      limits: PLANS[state.plan].limits,
      used,
      refCode: state.refCode,
      referrals,
      refBonusDays: state.refBonusDays,
      isAdmin: isAdminEmail(context.email),
      credits: await store.creditBalance(sql, context.userId, state),
    };
  });

export type SiteStatus = { payments: PaymentOptions; dbTemporary: boolean; exchanges: ExchangeRefs };

/** Public: how people can pay, exchange referral codes, and whether accounts are stored for real. */
export const getSiteStatus = createServerFn({ method: "GET" }).handler(async (): Promise<SiteStatus> => {
  const [pay, { dbSource }] = await Promise.all([import("./payments.server"), import("./db")]);
  const ref = (name: string) => process.env[name]?.trim() || null;
  return {
    payments: { ...pay.paymentOptions(await pay.storedDodo()), stars: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()) },
    dbTemporary: Boolean(process.env.VERCEL || process.env.RENDER) && dbSource === "pglite",
    exchanges: {
      binance: ref("BINANCE_REF"),
      bybit: ref("BYBIT_REF"),
      okx: ref("OKX_REF"),
      bitget: ref("BITGET_REF"),
      kucoin: ref("KUCOIN_REF"),
      mexc: ref("MEXC_REF"),
    },
  };
});

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: "unavailable" | "failed" | "bad_input" | "min_amount" };

/** Creates a pending payment and returns the provider's checkout page. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { plan?: string; period?: string; method?: string }) => ({
    plan: asPaidPlan(input.plan),
    period: asPeriod(input.period),
    method: input.method === "card" ? ("card" as const) : ("crypto" as const),
  }))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    if (!data.plan) return { ok: false, error: "bad_input" };
    const [{ getSql }, store, pay, { getRequest }, { publicOrigin }] = await Promise.all([
      import("./db"),
      import("./billing-store.server"),
      import("./payments.server"),
      import("@tanstack/react-start/server"),
      import("./http.server"),
    ]);
    const stored = await pay.storedDodo();
    const options = pay.paymentOptions(stored);
    if ((data.method === "card" && !options.card) || (data.method === "crypto" && !options.crypto))
      return { ok: false, error: "unavailable" };
    // The card on-ramp's partner refuses payments below its minimum.
    if (data.method === "card" && options.cardMin !== null && priceOf(data.plan, data.period) < options.cardMin)
      return { ok: false, error: "min_amount" };
    const provider = data.method === "card" ? (pay.cardProvider(stored) ?? "stripe") : "nowpayments";
    const request = getRequest();
    const origin = request ? publicOrigin(request) : "";
    const sql = await getSql();
    const payment = await store.createPayment(sql, context.userId, data.plan, data.period, provider);
    try {
      const input = {
        paymentId: payment.id,
        plan: data.plan,
        period: data.period,
        amount: payment.amount,
        email: context.email,
        origin,
      };
      const session =
        provider === "stripe"
          ? await pay.stripeCheckout(input)
          : provider === "dodo"
            ? await pay.dodoCheckout(input, pay.resolveDodo(stored)!)
            : await pay.nowpaymentsCheckout(input, data.method === "card" ? pay.nowpaymentsCardCurrency() : null);
      if (session.externalId) await store.setPaymentExternalId(sql, payment.id, session.externalId);
      return { ok: true, url: session.url };
    } catch (err) {
      console.error("[billing] checkout failed:", err);
      await store.markFailed(sql, payment.id);
      return { ok: false, error: "failed" };
    }
  });

export type StarsCheckoutResult = { ok: true; url: string; stars: number } | { ok: false; error: "unavailable" | "failed" | "bad_input" };

/**
 * A Telegram Stars invoice for one month of a plan. Inside the Telegram app it
 * opens with WebApp.openInvoice; in a browser the link opens Telegram.
 */
export const startStarsCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { plan?: string; lang?: string }) => ({ plan: asPaidPlan(input.plan), en: input.lang === "en" }))
  .handler(async ({ data, context }): Promise<StarsCheckoutResult> => {
    if (!data.plan) return { ok: false, error: "bad_input" };
    if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return { ok: false, error: "unavailable" };
    const [{ getSql }, store, tg] = await Promise.all([import("./db"), import("./billing-store.server"), import("./telegram.server")]);
    const sql = await getSql();
    const stars = STAR_PRICES[data.plan];
    const payment = await store.createPayment(sql, context.userId, data.plan, "month", "telegram");
    const name = `Скан ${PLAN_LABEL[data.plan]}`;
    try {
      const url = await tg.createStarsInvoice({
        paymentId: payment.id,
        title: data.en ? `${name} — 30 days` : `${name} — 30 дней`,
        description: data.en
          ? `The ${PLAN_LABEL[data.plan]} plan for 30 days: AI analysis, alerts and the screener. One-time payment, no auto-renewal.`
          : `Тариф ${PLAN_LABEL[data.plan]} на 30 дней: разборы ИИ, уведомления и скринер. Разовая оплата, без автосписаний.`,
        stars,
      });
      return { ok: true, url, stars };
    } catch (err) {
      console.error("[billing] stars invoice failed:", err instanceof Error ? err.message : err);
      await store.markFailed(sql, payment.id);
      return { ok: false, error: "failed" };
    }
  });

/**
 * Back from checkout: asks the provider about this member's unsettled payments,
 * so the plan switches on even when the provider's webhook didn't arrive.
 */
export const confirmPayments = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ granted: boolean }> => {
    const [{ getSql }, store, { recheckPayment }] = await Promise.all([
      import("./db"),
      import("./billing-store.server"),
      import("./webhook.server"),
    ]);
    const pending = await store.pendingPayments(await getSql(), context.userId);
    let granted = false;
    for (const payment of pending) if ((await recheckPayment(payment)) === "granted") granted = true;
    return { granted };
  });

/** Links a fresh account to the friend who invited it (called once after sign-up). */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code?: string }) => ({
    code: String(input.code ?? "")
      .slice(0, 16)
      .replace(/[^a-z0-9]/gi, ""),
  }))
  .handler(async ({ data, context }) => {
    if (!data.code) return { result: "bad_code" as const };
    const [{ getSql }, store, { getRequest }, { clientIp }] = await Promise.all([
      import("./db"),
      import("./billing-store.server"),
      import("@tanstack/react-start/server"),
      import("./http.server"),
    ]);
    const request = getRequest();
    const result = await store.claimReferral(await getSql(), context.userId, data.code, {
      ip: request ? clientIp(request) : null,
    });
    return { result };
  });

export type WaitlistResult = { ok: true } | { ok: false; error: "email" | "too_often" };

/** Public: leave an email to be told (and gifted Pro days) when online payment goes live. */
export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((input: { email?: string; plan?: string; period?: string }) => ({
    email: String(input.email ?? "").trim().slice(0, 200),
    plan: asPaidPlan(input.plan) ?? "pro",
    period: asPeriod(input.period),
  }))
  .handler(async ({ data }): Promise<WaitlistResult> => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return { ok: false, error: "email" };
    const [{ getSql }, store, { getRequest }, { clientIp }, { allow }] = await Promise.all([
      import("./db"),
      import("./billing-store.server"),
      import("@tanstack/react-start/server"),
      import("./http.server"),
      import("./rate-limit"),
    ]);
    const request = getRequest();
    if (request && !allow(`ip:${clientIp(request)}`, "waitlist", 5, 10 * 60_000)) return { ok: false, error: "too_often" };
    let userId: string | null = null;
    if (request) {
      try {
        const { auth } = await import("./auth/server");
        userId = (await auth.api.getSession({ headers: request.headers }))?.user?.id ?? null;
      } catch {
        userId = null;
      }
    }
    await store.joinWaitlist(await getSql(), { email: data.email, userId, plan: data.plan, period: data.period });
    return { ok: true };
  });
