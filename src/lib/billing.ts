import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asPaidPlan, asPeriod, PLANS, type Billing, type PaymentOptions } from "./plans";

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
    };
  });

/** Public: how people can pay, and whether accounts are stored for real. */
export const getSiteStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ payments: PaymentOptions; dbTemporary: boolean }> => {
    const [{ paymentOptions }, { dbSource }] = await Promise.all([
      import("./payments.server"),
      import("./db"),
    ]);
    return {
      payments: paymentOptions(),
      dbTemporary: Boolean(process.env.VERCEL) && dbSource === "pglite",
    };
  },
);

export type CheckoutResult =
  { ok: true; url: string } | { ok: false; error: "unavailable" | "failed" | "bad_input" };

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
    const [{ getSql }, store, pay, { getRequest }] = await Promise.all([
      import("./db"),
      import("./billing-store.server"),
      import("./payments.server"),
      import("@tanstack/react-start/server"),
    ]);
    const options = pay.paymentOptions();
    if ((data.method === "card" && !options.card) || (data.method === "crypto" && !options.crypto))
      return { ok: false, error: "unavailable" };
    const request = getRequest();
    const origin = request ? new URL(request.url).origin : "";
    const sql = await getSql();
    const payment = await store.createPayment(
      sql,
      context.userId,
      data.plan,
      data.period,
      data.method === "card" ? "stripe" : "nowpayments",
    );
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
        data.method === "card"
          ? await pay.stripeCheckout(input)
          : await pay.nowpaymentsCheckout(input);
      if (session.externalId) await store.setPaymentExternalId(sql, payment.id, session.externalId);
      return { ok: true, url: session.url };
    } catch (err) {
      console.error("[billing] checkout failed:", err);
      await store.markFailed(sql, payment.id);
      return { ok: false, error: "failed" };
    }
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
