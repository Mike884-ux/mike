import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { AiFailureReason } from "./coin-detail";
import { asLang } from "./lang";
import { allow } from "./rate-limit";

export const RISKS = ["low", "medium", "high"] as const;
export const HORIZONS = ["short", "medium", "long"] as const;
export type Risk = (typeof RISKS)[number];
export type Horizon = (typeof HORIZONS)[number];

const StrategySchema = z.object({
  title: z.string(),
  summary: z.string(),
  marketRead: z.string(),
  allocation: z.array(z.object({ asset: z.string(), sharePct: z.number(), why: z.string() })),
  rules: z.array(z.string()),
  entries: z.array(z.string()),
  risks: z.array(z.string()),
  portfolioNotes: z.array(z.string()),
  nextReview: z.string(),
});

export type StrategyPlan = z.infer<typeof StrategySchema>;

const SYSTEM = `You are a seasoned crypto portfolio strategist advising a retail investor. You get: the investor's risk appetite and horizon, the market mood (Fear & Greed), top coins by market cap with their 24h/7d moves, what's trending, technical reads on BTC/ETH/SOL (daily), and the investor's current holdings with P/L.

Write a concrete, personalised plan:
- title: 3–6 words naming the approach (e.g. "Core BTC/ETH with DCA").
- summary: 2–3 sentences: what to do and why it fits this risk/horizon now.
- marketRead: 2–4 sentences on current conditions using the numbers given.
- allocation: 3–6 lines; sharePct must sum to 100 and may include "Stablecoins / cash". Low risk → mostly BTC/ETH + cash; high risk may add alts, never more than 25% in one small alt.
- rules: 4–6 position-sizing / DCA / stop / take-profit rules with concrete percentages.
- entries: 2–4 lines on when and how to enter (levels or conditions from the data).
- risks: 3–4 specific risks for this plan.
- portfolioNotes: for each current holding, one line: keep / trim / add and why (empty list if no holdings).
- nextReview: when to revisit the plan and what would change it.
Plain text in every field, no markdown. Probabilities and risks, never guarantees. This is educational analysis, not financial advice.`;

const RISK_TEXT: Record<Risk, string> = {
  low: "low (capital preservation matters most, small drawdowns only)",
  medium: "medium (accepts 20–30% drawdowns for growth)",
  high: "high (accepts large drawdowns chasing outsized returns)",
};
const HORIZON_TEXT: Record<Horizon, string> = { short: "short: weeks", medium: "medium: 3–12 months", long: "long: 1–4 years" };

const cache = new Map<string, { at: number; value: StrategyPlan }>();
const TTL = 10 * 60_000;

/** A personalised strategy from live market data and the member's saved portfolio. */
export const getStrategyAdvice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { risk?: string; horizon?: string; lang?: string }) => ({
    risk: (RISKS.includes(input.risk as Risk) ? input.risk : "medium") as Risk,
    horizon: (HORIZONS.includes(input.horizon as Horizon) ? input.horizon : "medium") as Horizon,
    lang: asLang(input.lang),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true; plan: StrategyPlan } | { ok: false; reason: AiFailureReason }> => {
    const [{ getSql }, store] = await Promise.all([import("./db"), import("./account-store.server")]);
    const { positions } = await store.loadAccount(await getSql(), context.userId);
    const key = `${context.userId}:${data.risk}:${data.horizon}:${data.lang}:${positions.map((p) => `${p.base}=${p.qty}`).join(",")}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return { ok: true, plan: hit.value };
    if (!allow(context.userId, "strategy", 6, 300_000)) return { ok: false, reason: "too_often" };
    const { withAiQuota } = await import("./quota.server");
    return withAiQuota(context, "strategy", async () => {
      const [coins, market, { loadCoinContext }] = await Promise.all([
        import("./coins.server"),
        import("./market.server"),
        import("./coin-context.server"),
      ]);
      const [listing, global, trending, reads, tickers] = await Promise.all([
        coins.getListing(1).catch(() => null),
        coins.getGlobal().catch(() => null),
        coins.getTrending().catch(() => null),
        Promise.all(["BTC", "ETH", "SOL"].map((b) => loadCoinContext(b, "1d").catch(() => null))),
        positions.length ? market.fetchTickers(positions.map((p) => p.symbol)).catch(() => []) : Promise.resolve([]),
      ]);
      const top = (listing?.coins ?? []).slice(0, 15).map((c) => `${c.symbol} ${c.price} (24h ${c.change24h?.toFixed(1) ?? "?"}%, 7d ${c.change7d?.toFixed(1) ?? "?"}%)`);
      const priceOf = new Map(tickers.map((t) => [t.symbol, t.price]));
      const holdings = positions.map((p) => {
        const price = priceOf.get(p.symbol) ?? p.entry;
        return `${p.base}: qty ${p.qty}, entry ${p.entry}, now ${price}, P/L ${(((price - p.entry) / p.entry) * 100).toFixed(1)}%`;
      });
      const lines = [
        `Risk appetite: ${RISK_TEXT[data.risk]}. Horizon: ${HORIZON_TEXT[data.horizon]}.`,
        global ? `Market: total cap ${global.marketCap ? (global.marketCap / 1e12).toFixed(2) + "T" : "?"} USD (24h ${global.marketCapChange24h?.toFixed(2) ?? "?"}%), BTC dominance ${global.btcDominance?.toFixed(1) ?? "?"}%, Fear & Greed ${global.fearGreed ? `${global.fearGreed.value} (${global.fearGreed.label})` : "?"}.` : "",
        top.length ? `Top coins: ${top.join("; ")}.` : "",
        trending?.length ? `Trending searches: ${trending.slice(0, 6).map((c) => c.symbol).join(", ")}.` : "",
        ...reads.map((ctx) =>
          ctx
            ? `${ctx.base} daily: price ${ctx.price}, trend ${ctx.technicals.trend}, RSI ${ctx.technicals.rsi}, ADX ${ctx.technicals.adx}, score ${ctx.score} (${ctx.signal}), weekly trend ${ctx.higherTf?.trend ?? "?"}.`
            : "",
        ),
        holdings.length ? `Current holdings:\n${holdings.join("\n")}` : "Current holdings: none yet.",
      ];
      const { completeJson } = await import("./ai.server");
      const result = await completeJson(
        { system: SYSTEM, messages: [{ role: "user", text: lines.filter(Boolean).join("\n") }], effort: "high", maxTokens: 10000, lang: data.lang },
        StrategySchema,
      );
      if (!result.ok) return { ok: false, reason: result.reason };
      const plan = normalize(result.value);
      cache.set(key, { at: Date.now(), value: plan });
      return { ok: true, plan };
    });
  });

/** Trim lists and make the allocation add up to 100. */
export function normalize(raw: StrategyPlan): StrategyPlan {
  const clean = (list: string[], max: number) => list.map((s) => s.trim()).filter(Boolean).slice(0, max);
  let allocation = raw.allocation
    .map((a) => ({ asset: a.asset.trim(), sharePct: Math.max(0, Math.round(a.sharePct)), why: a.why.trim() }))
    .filter((a) => a.asset && a.sharePct > 0)
    .slice(0, 6);
  const sum = allocation.reduce((s, a) => s + a.sharePct, 0);
  if (sum > 0 && sum !== 100) {
    allocation = allocation.map((a) => ({ ...a, sharePct: Math.round((a.sharePct / sum) * 100) }));
    const drift = 100 - allocation.reduce((s, a) => s + a.sharePct, 0);
    if (allocation[0]) allocation[0].sharePct += drift;
  }
  return {
    title: raw.title.trim(),
    summary: raw.summary.trim(),
    marketRead: raw.marketRead.trim(),
    allocation,
    rules: clean(raw.rules, 6),
    entries: clean(raw.entries, 4),
    risks: clean(raw.risks, 4),
    portfolioNotes: clean(raw.portfolioNotes, 12),
    nextReview: raw.nextReview.trim(),
  };
}
