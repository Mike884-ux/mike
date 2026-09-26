import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { AiFailure } from "./ai.server";
import type { CoinContext } from "./coin-context.server";
import { factorTextRu } from "./indicators";
import { asLang } from "./lang";
import { assetOf, symbolOf } from "./markets";
import { allow } from "./rate-limit";
import { asInterval, type AiLevels } from "./types";

export type CoinChartData = Omit<CoinContext, "symbol">;

export type AiFailureReason = AiFailure | "too_often" | "no_data" | "limit";

/** Lets the detail view switch timeframe on its own, independent of the scanner's global interval. */
export const getCoinChart = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { base?: string; interval?: string }) => ({
    base: String(input.base ?? "").toUpperCase(),
    interval: asInterval(input.interval),
  }))
  .handler(async ({ data }): Promise<CoinChartData | null> => {
    if (!data.base) return null;
    const { loadCoinContext } = await import("./coin-context.server");
    const ctx = await loadCoinContext(data.base, data.interval);
    if (!ctx) return null;
    const rest: Partial<CoinContext> = { ...ctx };
    delete rest.symbol;
    return rest as CoinChartData;
  });

export type CoinExtras = {
  high24h?: number;
  low24h?: number;
  volume?: number;
  buyRatio: number | null;
};

export const getCoinExtras = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { base?: string; interval?: string }) => ({
    base: String(input.base ?? "").toUpperCase(),
    interval: asInterval(input.interval),
  }))
  .handler(async ({ data }): Promise<CoinExtras> => {
    const asset = assetOf(data.base);
    if (!data.base || !asset) return { buyRatio: null };
    const marketMod = await import("./market.server");
    const symbol = symbolOf(asset);
    const [ticker, buyRatio] = await Promise.all([
      marketMod.fetchTickerDetail(symbol),
      marketMod.fetchBuyPressure(symbol, data.interval),
    ]);
    return {
      high24h: ticker?.high24h,
      low24h: ticker?.low24h,
      volume: ticker?.volume,
      buyRatio,
    };
  });

const LevelsSchema = z.object({
  direction: z.enum(["LONG", "SHORT", "WAIT"]),
  confidence: z.number(),
  verdict: z.string(),
  summary: z.string(),
  reasons: z.array(z.string()),
  risks: z.array(z.string()),
  bullCase: z.string(),
  bearCase: z.string(),
  invalidation: z.string(),
  horizon: z.string(),
  support: z.number().nullable(),
  resistance: z.number().nullable(),
  entry: z.number().nullable(),
  stopLoss: z.number().nullable(),
  target: z.number().nullable(),
  target2: z.number().nullable(),
});

type RawLevels = z.infer<typeof LevelsSchema>;

/**
 * Keep only levels that make sense for the call: near the price, and stop /
 * target on the correct sides of the entry. A long with the stop above entry
 * is worse than no stop at all.
 */
export function sanitizeLevels(raw: RawLevels, price: number, technicalScore: number): AiLevels {
  const near = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) && v > price * 0.5 && v < price * 1.5 ? v : undefined;
  let entry = near(raw.entry);
  let stopLoss = near(raw.stopLoss);
  let target = near(raw.target);
  let target2 = near(raw.target2);
  const direction = raw.direction;
  if (direction === "LONG" && entry !== undefined) {
    if (stopLoss !== undefined && stopLoss >= entry) stopLoss = undefined;
    if (target !== undefined && target <= entry) target = undefined;
    if (target2 !== undefined && (target === undefined || target2 <= target)) target2 = undefined;
  } else if (direction === "SHORT" && entry !== undefined) {
    if (stopLoss !== undefined && stopLoss <= entry) stopLoss = undefined;
    if (target !== undefined && target >= entry) target = undefined;
    if (target2 !== undefined && (target === undefined || target2 >= target)) target2 = undefined;
  } else if (direction === "WAIT") {
    // No trade, no trade plan — only the reference levels stay.
    entry = stopLoss = target = target2 = undefined;
  }
  const riskReward =
    entry !== undefined && stopLoss !== undefined && target !== undefined && entry !== stopLoss
      ? Number((Math.abs(target - entry) / Math.abs(entry - stopLoss)).toFixed(2))
      : undefined;

  const technicalDirection = technicalScore >= 30 ? "LONG" : technicalScore <= -30 ? "SHORT" : "WAIT";
  const agrees = direction === technicalDirection || (direction === "WAIT" && Math.abs(technicalScore) < 30);
  let confidence = Math.max(0, Math.min(100, Math.round(raw.confidence)));
  // Overconfidence guard: a call the indicators don't back is capped lower.
  confidence = Math.min(confidence, agrees ? 90 : 65);

  const clean = (list: string[], max: number) => list.map((s) => s.trim()).filter(Boolean).slice(0, max);
  return {
    direction,
    confidence,
    support: near(raw.support),
    resistance: near(raw.resistance),
    entry,
    stopLoss,
    target,
    target2,
    riskReward,
    verdict: raw.verdict.trim(),
    summary: raw.summary.trim(),
    reasons: clean(raw.reasons, 5),
    risks: clean(raw.risks, 4),
    bullCase: raw.bullCase.trim(),
    bearCase: raw.bearCase.trim(),
    invalidation: raw.invalidation.trim(),
    horizon: raw.horizon.trim(),
    agreesWithIndicators: agrees,
  };
}

const chartCache = new Map<string, { at: number; value: AiLevels }>();
const CHART_TTL = 180_000;

const ANALYST_SYSTEM = `You are a senior crypto and equity market analyst writing for a retail trader.
You get fresh numbers computed from real candles: indicators, a points-based technical score, the trend on the next higher timeframe, a walk-forward backtest of the indicator rule on this very asset, buyer/seller volume share, the Fear & Greed index and recent headlines.

How to think:
- Weigh everything together. Say where the evidence agrees and where it conflicts.
- Respect the higher timeframe: trading against it needs a strong reason.
- Treat the backtest hit rate as evidence about how reliable indicator signals have been on this asset. Below ~50% or under 8 trades means low reliability — lower your confidence.
- A relevant headline can outweigh neutral technicals; ignore headlines that are not about this asset.
- Choose WAIT when the edge is unclear. WAIT is a good answer, not a failure.
- Levels must be realistic and close to the current price, derived from ATR and recent structure: for LONG stopLoss < entry < target < target2; for SHORT the reverse. For WAIT set entry, stopLoss, target and target2 to null.
- confidence is 0–100 and must reflect real uncertainty; above 80 only when almost everything agrees.
- Every reason cites a concrete number or fact from the data. No generic filler.
- This is analysis, not financial advice. Never promise outcomes.

Fields: verdict = one decisive sentence; summary = 3–5 sentences of reasoning; reasons = 3–5 bullet points; risks = 2–4 bullet points; bullCase / bearCase = what would happen and at what price; invalidation = the price or event that proves the call wrong; horizon = how long the idea should take to play out.`;

function describeContext(ctx: CoinContext, extras: { buyRatio: number | null; fng?: { value: number; label: string }; headlines: string[] }): string {
  const t = ctx.technicals;
  const lines = [
    `Asset: ${ctx.base}.`,
    `Price: ${ctx.price}. 24h change: ${ctx.change24h.toFixed(2)}%. 10-candle change: ${t.roc10}%.`,
    `Trend (EMA 9/21/50): ${t.trend}. EMA9 ${t.ema9}, EMA21 ${t.ema21}, EMA50 ${t.ema50}.`,
    `RSI ${t.rsi}. Stoch RSI %K ${t.stochK}. MACD ${t.macd} vs signal ${t.macdSignal}, histogram slope ${t.macdHistSlope}.`,
    `ADX ${t.adx} (+DI ${t.plusDI}, −DI ${t.minusDI}). Bollinger %B ${t.bbPercentB}, band width ${t.bbWidth}%.`,
    `ATR ${t.atr} (${t.atrPct}% of price). Volume vs 20-candle average: ${t.volumeRatio}x. OBV: ${t.obvTrend}.`,
    `Technical score: ${ctx.score} (−100…+100) → ${ctx.signal}. Main factors: ${ctx.factors.slice(0, 6).map(factorTextRu).join("; ")}.`,
    ctx.higherTf ? `Higher timeframe (${ctx.higherTf.interval}) trend: ${ctx.higherTf.trend}.` : "Higher timeframe: no data.",
    ctx.backtest.trades
      ? `Backtest of the indicator rule on this asset: ${ctx.backtest.wins}/${ctx.backtest.trades} signals worked (${ctx.backtest.hitRate}%), average move ${ctx.backtest.avgMovePct}%.`
      : "Backtest: not enough signals in history.",
    extras.buyRatio !== null ? `Taker buy share of recent volume: ${Math.round(extras.buyRatio * 100)}%.` : "",
    extras.fng ? `Crypto Fear & Greed: ${extras.fng.value} (${extras.fng.label}).` : "",
    `Recent swing high/low (last 50 candles): ${Math.max(...ctx.candles.slice(-50).map((c) => c.h))} / ${Math.min(...ctx.candles.slice(-50).map((c) => c.l))}.`,
    extras.headlines.length ? `Headlines about this asset:\n${extras.headlines.map((h) => `- ${h}`).join("\n")}` : "No recent headlines about this asset.",
  ];
  return lines.filter(Boolean).join("\n");
}

export const analyzeChartAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { base?: string; interval?: string; lang?: string }) => ({
    base: String(input.base ?? "").toUpperCase(),
    interval: asInterval(input.interval),
    lang: asLang(input.lang),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true; levels: AiLevels } | { ok: false; reason: AiFailureReason }> => {
    if (!data.base || !assetOf(data.base)) return { ok: false, reason: "no_data" };
    const key = `${data.base}:${data.interval}:${data.lang}`;
    const hit = chartCache.get(key);
    if (hit && Date.now() - hit.at < CHART_TTL) return { ok: true, levels: hit.value };
    if (!allow(context.userId, "chart-ai", 10, 180_000)) return { ok: false, reason: "too_often" };
    const { withAiQuota } = await import("./quota.server");
    return withAiQuota(context, "analysis", async () => {
      const { loadCoinContext } = await import("./coin-context.server");
      const marketMod = await import("./market.server");
      const { queryHeadlines } = await import("./news.server");
      const ctx = await loadCoinContext(data.base, data.interval);
      if (!ctx) return { ok: false, reason: "no_data" };
      const [buyRatio, fng, headlines] = await Promise.all([
        marketMod.fetchBuyPressure(ctx.symbol, data.interval).catch(() => null),
        assetOf(data.base)?.kind === "crypto" ? marketMod.fetchFearGreed().catch(() => undefined) : Promise.resolve(undefined),
        queryHeadlines(data.base, "raw").catch(() => []),
      ]);

      const { completeJson } = await import("./ai.server");
      const result = await completeJson(
        {
          system: ANALYST_SYSTEM,
          messages: [
            {
              role: "user",
              text: `Timeframe: ${data.interval}.\n${describeContext(ctx, {
                buyRatio,
                fng,
                headlines: headlines.slice(0, 6).map((h) => h.title),
              })}`,
            },
          ],
          effort: "high",
          maxTokens: 12000,
          lang: data.lang,
        },
        LevelsSchema,
      );
      if (!result.ok) return { ok: false, reason: result.reason };
      const levels = sanitizeLevels(result.value, ctx.price, ctx.score);
      chartCache.set(key, { at: Date.now(), value: levels });
      return { ok: true, levels };
    });
  });

const simpleCache = new Map<string, { at: number; value: string }>();
const SIMPLE_TTL = 180_000;

/** Rephrases an already-generated AI verdict in plain, jargon-free language for a non-trader. */
export const explainSimple = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: { base?: string; interval?: string; direction?: string; verdict?: string; reasons?: string[]; lang?: string }) => ({
      base: String(input.base ?? "").toUpperCase(),
      interval: asInterval(input.interval),
      direction: input.direction === "LONG" || input.direction === "SHORT" ? input.direction : "WAIT",
      verdict: String(input.verdict ?? "").slice(0, 600),
      reasons: Array.isArray(input.reasons) ? input.reasons.map((r) => String(r).slice(0, 300)).slice(0, 5) : [],
      lang: asLang(input.lang),
    }),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; text: string } | { ok: false; reason: AiFailureReason }> => {
    if (!data.base || !data.verdict) return { ok: false, reason: "no_data" };
    const key = `${data.base}:${data.interval}:${data.lang}:${data.verdict}`;
    const hit = simpleCache.get(key);
    if (hit && Date.now() - hit.at < SIMPLE_TTL) return { ok: true, text: hit.value };
    if (!allow(context.userId, "chart-ai", 10, 180_000)) return { ok: false, reason: "too_often" };
    const { completeText } = await import("./ai.server");
    const direction = data.direction === "LONG" ? "buy" : data.direction === "SHORT" ? "sell" : "wait";
    const result = await completeText({
      system:
        "Explain a market analyst's conclusion to someone who has never traded, as if to a friend. No jargon (RSI, MACD, EMA, support, long/short) — translate their meaning into everyday words. 3–5 short sentences. No guarantees, no investment advice. Plain text only: no headings, no markdown, no JSON.",
      messages: [
        {
          role: "user",
          text: [
            `Asset: ${data.base}.`,
            `Analyst conclusion: ${data.verdict}`,
            data.reasons.length ? `Reasons: ${data.reasons.join("; ")}` : "",
            `Suggested action: ${direction}.`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      effort: "low",
      maxTokens: 2000,
      lang: data.lang,
    });
    if (!result.ok) return { ok: false, reason: result.reason };
    simpleCache.set(key, { at: Date.now(), value: result.text });
    return { ok: true, text: result.text };
  });
