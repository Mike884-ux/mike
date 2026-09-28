import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { AiFailureReason } from "./coin-detail";
import type { AdminStats, PaymentRow } from "./billing-store.server";
import { asLang } from "./lang";
import { findDatabaseUrl } from "../../scripts/database-url.mjs";
import {
  asPaidPlan,
  PLANS,
  TRIAL_DAYS,
  REFERRAL_BONUS_DAYS,
  YEAR_DISCOUNT_PCT,
  type AiKind,
  type PlanId,
} from "./plans";

class ForbiddenError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden");
  }
}

async function requireAdmin(email: string) {
  const { isAdminEmail } = await import("./quota.server");
  if (!isAdminEmail(email)) throw new ForbiddenError();
}

export type SetupItem = { key: string; ok: boolean };

export type AdminOverview = { stats: AdminStats; payments: PaymentRow[]; setup: SetupItem[] };

/** Numbers for the owner: sign-ups, paying members, revenue, AI load, and which keys are set. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await requireAdmin(context.email);
    const [{ getSql }, store, pay] = await Promise.all([
      import("./db"),
      import("./billing-store.server"),
      import("./payments.server"),
    ]);
    const sql = await getSql();
    const [stats, payments] = await Promise.all([
      store.adminStats(sql),
      store.recentPayments(sql, 30),
    ]);
    const has = (...names: string[]) => names.every((n) => Boolean(process.env[n]?.trim()));
    const setup: SetupItem[] = [
      { key: "DATABASE_URL", ok: Boolean(findDatabaseUrl(process.env)) },
      { key: "BETTER_AUTH_SECRET", ok: has("BETTER_AUTH_SECRET") },
      {
        key: "ANTHROPIC_API_KEY",
        ok: has("ANTHROPIC_API_KEY") || Boolean(process.env.GEMINI_API_KEY?.trim().startsWith("sk-ant-")) || Boolean(process.env.VERCEL),
      },
      { key: "GEMINI_API_KEY", ok: has("GEMINI_API_KEY") && !process.env.GEMINI_API_KEY?.trim().startsWith("sk-ant-") },
      { key: "GOOGLE_CLIENT_ID", ok: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET") },
      { key: "TWITTER_CLIENT_ID", ok: has("TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET") },
      { key: "RESEND_API_KEY", ok: has("RESEND_API_KEY") },
      { key: "NOWPAYMENTS_API_KEY", ok: has("NOWPAYMENTS_API_KEY", "NOWPAYMENTS_IPN_SECRET") },
      { key: "NOWPAYMENTS_CARD", ok: pay.cardProvider() === "nowpayments" },
      { key: "STRIPE_SECRET_KEY", ok: has("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET") },
      { key: "DODO_API_KEY", ok: pay.cardProvider(await pay.storedDodo()) === "dodo" },
      { key: "PAY_CONTACT", ok: has("PAY_CONTACT") },
      { key: "TELEGRAM_BOT_TOKEN", ok: has("TELEGRAM_BOT_TOKEN") },
    ];
    return { stats, payments, setup };
  });

export type MemberInfo = {
  id: string;
  email: string;
  name: string;
  plan: PlanId;
  until: number | null;
  trial: boolean;
  used: Record<AiKind, number>;
  referrals: number;
};

async function memberInfo(email: string): Promise<MemberInfo | null> {
  const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
  const sql = await getSql();
  const user = await store.findUserByEmail(sql, email);
  if (!user) return null;
  const [state, used, referrals] = await Promise.all([
    store.loadPlan(sql, user.id),
    store.usageToday(sql, user.id),
    store.referralCount(sql, user.id),
  ]);
  return { ...user, plan: state.plan, until: state.until, trial: state.trial, used, referrals };
}

export const adminFindMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email?: string }) => ({
    email: String(input.email ?? "")
      .trim()
      .slice(0, 200),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.email);
    return { member: data.email ? await memberInfo(data.email) : null };
  });

/** Give a member a plan for N days (after a manual payment, a giveaway, a refund…), or take it away. */
export const adminSetPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email?: string; plan?: string; days?: number }) => ({
    email: String(input.email ?? "")
      .trim()
      .slice(0, 200),
    plan: input.plan === "free" ? ("free" as const) : asPaidPlan(input.plan),
    days: Math.max(1, Math.min(3650, Math.round(Number(input.days) || 30))),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.email);
    if (!data.plan) return { ok: false as const, error: "bad_input" as const };
    const [{ getSql }, store] = await Promise.all([
      import("./db"),
      import("./billing-store.server"),
    ]);
    const sql = await getSql();
    const user = await store.findUserByEmail(sql, data.email);
    if (!user) return { ok: false as const, error: "not_found" as const };
    if (data.plan === "free") await store.revokePlan(sql, user.id);
    else await store.grantPlan(sql, user.id, data.plan, data.days);
    console.log(
      `[admin] ${context.email} set ${data.email} to ${data.plan}${data.plan === "free" ? "" : ` +${data.days}d`}`,
    );
    return { ok: true as const, member: await memberInfo(data.email) };
  });

export const MARKETING_CHANNELS = ["telegram", "instagram", "tiktok", "x"] as const;
export const MARKETING_GOALS = ["signup", "pro", "referral", "market"] as const;
export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];
export type MarketingGoal = (typeof MARKETING_GOALS)[number];

const CHANNEL_BRIEF: Record<MarketingChannel, string> = {
  telegram:
    "a Telegram channel post: 80–150 words, short paragraphs, 2–4 fitting emoji, a clear call to action with the link on its own line",
  instagram:
    "an Instagram caption: a strong first line hook, 60–120 words, line breaks, 3–5 emoji, then 8–12 relevant hashtags on the last line; say 'link in bio' instead of pasting the link",
  tiktok:
    "a 30–40 second TikTok / Reels video script: HOOK (first 3 seconds), 3–4 short scenes with what to show on screen and what to say, and a closing call to action; then one caption line with 4–6 hashtags",
  x: "one post for X (Twitter), at most 270 characters including the link, punchy, 1–2 emoji, no hashtags spam (max 2)",
};

const GOAL_BRIEF: Record<MarketingGoal, string> = {
  signup: `get people to create a free account (new accounts get ${TRIAL_DAYS} days of Pro free)`,
  pro: `sell the Pro plan ($${PLANS.pro.month}/month, or ${YEAR_DISCOUNT_PCT}% off yearly) — focus on what the AI analyst saves the trader: time, emotional mistakes, missed levels`,
  referral: `get members to invite friends: each friend gets 7 days of Pro, the inviter gets +${REFERRAL_BONUS_DAYS} days of Pro per friend`,
  market:
    "a quick market update built on today's numbers that ends by inviting readers to get the full AI breakdown on the site",
};

const MARKETING_SYSTEM = `You are the growth marketer for "Скан" (Scan), a crypto market website: live prices for thousands of coins, buy/sell signals from 8 technical indicators with historical accuracy, an AI analyst that gives levels (entry, stop, targets) and plain-language explanations, AI portfolio advice, AI strategies, a portfolio tracker and crypto news.
Plans: Free (a few AI requests a day), Pro ($${PLANS.pro.month}/mo) and Whale ($${PLANS.max.month}/mo); ${YEAR_DISCOUNT_PCT}% off when paying for a year; payments are one-time, no auto-renewal.
Write marketing copy that is energetic but honest: never promise profits or guaranteed returns, never invent user counts, reviews, testimonials or results. It's fine to use the live market numbers given. Mention that it is not financial advice only where natural, briefly.
Return only the finished text, ready to paste — no preface, no markdown headings, no quotes around it.`;

/** The owner's AI marketer: a ready-to-post text for a channel and goal, with today's market numbers. */
export const generateMarketing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { channel?: string; goal?: string; lang?: string; notes?: string }) => ({
    channel: (MARKETING_CHANNELS.includes(input.channel as MarketingChannel)
      ? input.channel
      : "telegram") as MarketingChannel,
    goal: (MARKETING_GOALS.includes(input.goal as MarketingGoal)
      ? input.goal
      : "signup") as MarketingGoal,
    lang: asLang(input.lang),
    notes: String(input.notes ?? "").slice(0, 500),
  }))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; text: string } | { ok: false; reason: AiFailureReason }> => {
      await requireAdmin(context.email);
      const [coins, { getRequest }, { completeText }] = await Promise.all([
        import("./coins.server"),
        import("@tanstack/react-start/server"),
        import("./ai.server"),
      ]);
      const [global, listing, trending] = await Promise.all([
        coins.getGlobal().catch(() => null),
        coins.getListing(1).catch(() => null),
        coins.getTrending().catch(() => null),
      ]);
      const request = getRequest();
      const site = request ? new URL(request.url).origin : "";
      const top = listing?.coins ?? [];
      const btc = top.find((c) => c.symbol === "BTC");
      const movers = [...top]
        .filter((c) => c.change24h !== null)
        .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
      const facts = [
        site ? `Site link: ${site}` : "",
        btc
          ? `BTC: $${Math.round(btc.price).toLocaleString("en-US")} (${btc.change24h?.toFixed(1) ?? "?"}% in 24h).`
          : "",
        global?.fearGreed
          ? `Fear & Greed index: ${global.fearGreed.value}/100 (${global.fearGreed.label}).`
          : "",
        global?.marketCap
          ? `Total crypto market cap: $${(global.marketCap / 1e12).toFixed(2)}T (${global.marketCapChange24h?.toFixed(1) ?? "?"}% 24h).`
          : "",
        movers[0]
          ? `Top gainer in the top 100 today: ${movers[0].name} (${movers[0].symbol}) +${movers[0].change24h?.toFixed(1)}%.`
          : "",
        movers.at(-1)
          ? `Biggest loser: ${movers.at(-1)!.name} ${movers.at(-1)!.change24h?.toFixed(1)}%.`
          : "",
        trending?.length
          ? `Trending coins: ${trending
              .slice(0, 5)
              .map((c) => c.symbol)
              .join(", ")}.`
          : "",
      ].filter(Boolean);
      const result = await completeText({
        system: MARKETING_SYSTEM,
        messages: [
          {
            role: "user",
            text: `Write ${CHANNEL_BRIEF[data.channel]}.\nGoal: ${GOAL_BRIEF[data.goal]}.\nToday's facts:\n${facts.join("\n")}${data.notes ? `\nOwner's notes: ${data.notes}` : ""}`,
          },
        ],
        effort: "medium",
        maxTokens: 3000,
        lang: data.lang,
      });
      return result.ok
        ? { ok: true, text: result.text.trim() }
        : { ok: false, reason: result.reason };
    },
  );

/** Everyone who asked to buy while payment was off, newest first. */
export const getWaitlist = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.email);
    const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
    return store.listWaitlist(await getSql());
  });

/** Keeps the waiting-list promise: Pro days for everyone on the list who has an account. */
export const adminGrantWaitlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.email);
    const [{ getSql }, store, { WAITLIST_GIFT_DAYS }] = await Promise.all([import("./db"), import("./billing-store.server"), import("./plans")]);
    const result = await store.grantWaitlist(await getSql(), WAITLIST_GIFT_DAYS);
    console.log(`[admin] ${context.email} granted waitlist Pro: ${result.granted}, pending ${result.pending}`);
    return result;
  });

export type DodoStatus = {
  hasKey: boolean;
  mode: "test" | "live";
  connected: boolean;
  webhookUrl: string | null;
  productId: string | null;
};

async function dodoStatus(): Promise<DodoStatus> {
  const pay = await import("./payments.server");
  const stored = await pay.storedDodo(true);
  const config = pay.resolveDodo(stored);
  return {
    hasKey: Boolean(process.env.DODO_API_KEY?.trim()),
    mode: pay.dodoMode(),
    connected: Boolean(config),
    webhookUrl: stored.webhookUrl ?? null,
    productId: config?.productId ?? null,
  };
}

export const getDodoStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.email);
    return dodoStatus();
  });

/**
 * One click in /admin: with DODO_API_KEY set, creates the Dodo product and the
 * webhook to this site, and saves them — no copying ids or secrets by hand.
 */
export const adminConnectDodo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true; status: DodoStatus } | { ok: false; error: "no_key" | "rejected" | "failed"; detail?: string }> => {
    await requireAdmin(context.email);
    if (!process.env.DODO_API_KEY?.trim()) return { ok: false, error: "no_key" };
    const [pay, { getSql }, store, { getRequest }, { publicOrigin }] = await Promise.all([
      import("./payments.server"),
      import("./db"),
      import("./billing-store.server"),
      import("@tanstack/react-start/server"),
      import("./http.server"),
    ]);
    const request = getRequest();
    const origin = request ? publicOrigin(request) : "";
    try {
      const keys = pay.dodoKeys();
      const sql = await getSql();
      const saved = await pay.connectDodo(`${origin}/api/billing/dodo`, await pay.storedDodo(true), (productId) =>
        store.setSettings(sql, { [keys.productId]: productId }),
      );
      await store.setSettings(sql, {
        [keys.productId]: saved.productId,
        [keys.webhookId]: saved.webhookId,
        [keys.webhookSecret]: saved.webhookSecret,
        [keys.webhookUrl]: saved.webhookUrl,
      });
      console.log(`[admin] ${context.email} connected Dodo (${pay.dodoMode()}) → ${saved.webhookUrl}`);
      return { ok: true, status: await dodoStatus() };
    } catch (err) {
      console.error("[admin] Dodo connect failed:", err);
      const status = err instanceof pay.DodoError ? err.status : 0;
      // The owner sees Dodo's own answer, so a refused field or network trouble is visible without logs.
      const detail = (err instanceof Error ? err.message : String(err)).replace(/Bearer\s+\S+/g, "Bearer …").slice(0, 300);
      return { ok: false, error: status === 401 || status === 403 ? "rejected" : "failed", detail };
    }
  });

export type TelegramStatus = {
  hasToken: boolean;
  bot: string | null;
  webhookUrl: string | null;
  /** The address for cron-job.org, with its key — shown to the owner only. */
  cronUrl: string | null;
  ownCronSecret: boolean;
};

async function telegramStatus(): Promise<TelegramStatus> {
  const [tg, { getSql }, store, { getRequest }, { siteOrigin }] = await Promise.all([
    import("./telegram.server"),
    import("./db"),
    import("./billing-store.server"),
    import("@tanstack/react-start/server"),
    import("./http.server"),
  ]);
  const saved = await store.getSettings(await getSql(), ["telegram:bot_username", "telegram:webhook_url"]);
  const request = getRequest();
  const secret = tg.cronSecret();
  return {
    hasToken: Boolean(tg.botToken()),
    bot: saved["telegram:bot_username"] ?? null,
    webhookUrl: saved["telegram:webhook_url"] ?? null,
    cronUrl: request && secret ? `${siteOrigin(request)}/api/cron/alerts?key=${encodeURIComponent(secret)}` : null,
    ownCronSecret: Boolean(process.env.CRON_SECRET?.trim()),
  };
}

export const getTelegramStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.email);
    return telegramStatus();
  });

/**
 * One click in /admin: points the bot's webhook at this site (with a secret
 * header), sets its command menu and remembers its @username.
 */
export const adminConnectTelegram = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true; status: TelegramStatus } | { ok: false; error: "no_key" | "rejected" | "failed"; detail?: string }> => {
    await requireAdmin(context.email);
    const [tg, { getSql }, store, { getRequest }, { publicOrigin }] = await Promise.all([
      import("./telegram.server"),
      import("./db"),
      import("./billing-store.server"),
      import("@tanstack/react-start/server"),
      import("./http.server"),
    ]);
    if (!tg.botToken()) return { ok: false, error: "no_key" };
    const request = getRequest();
    const webhookUrl = `${request ? publicOrigin(request) : ""}/api/telegram`;
    try {
      const me = await tg.tg<{ username?: string }>("getMe");
      await tg.tg("setWebhook", {
        url: webhookUrl,
        secret_token: tg.webhookSecret(),
        allowed_updates: ["message"],
        drop_pending_updates: true,
      });
      await tg.tg("setMyCommands", { commands: tg.BOT_COMMANDS });
      await store.setSettings(await getSql(), { "telegram:bot_username": me.username ?? "", "telegram:webhook_url": webhookUrl });
      console.log(`[admin] ${context.email} connected Telegram bot @${me.username} → ${webhookUrl}`);
      return { ok: true, status: await telegramStatus() };
    } catch (err) {
      console.error("[admin] Telegram connect failed:", err);
      const status = err instanceof tg.TelegramError ? err.status : 0;
      const detail = (err instanceof Error ? err.message : String(err)).replace(/bot\d+:[\w-]+/g, "bot…").slice(0, 300);
      return { ok: false, error: status === 401 || status === 404 ? "rejected" : "failed", detail };
    }
  });
