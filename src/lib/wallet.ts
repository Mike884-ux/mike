import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { allow } from "./rate-limit";
import type { AiFailureReason } from "./coin-detail";
import { asLang } from "./lang";
import { portfolioSeries } from "./portfolio-math";
import type { Ticker } from "./types";

export const getPrices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { symbols?: string[] }) => ({
    symbols: (Array.isArray(input.symbols) ? input.symbols : [])
      .map((s) => String(s).toUpperCase())
      .filter((s) => /^[A-Z0-9=.^-]{2,20}$/.test(s))
      .slice(0, 30),
  }))
  .handler(async ({ data }): Promise<Ticker[]> => {
    if (!data.symbols.length) return [];
    const marketMod = await import("./market.server");
    return marketMod.fetchTickers(data.symbols);
  });

const WALLET_SYSTEM = `You review a retail investor's spot portfolio. You get each holding with its entry price, current price, P/L, days held, share of the portfolio and a fresh technical read (indicator score and daily trend).
Think it through: concentration risk, positions deep in loss and for how long, holdings whose technicals turned against them, what is working.
Answer with: a one-line overall verdict; then 3–6 short lines, one per notable holding or issue, each naming the asset and a concrete number; then one line on what to watch next.
Plain text, simple dashes for lines, no markdown headings or bold. No guarantees; this is not financial advice.`;

/** AI review of the signed-in user's saved wallet. Positions are read from the database, not the browser. */
export const getWalletAdvice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { lang?: string }) => ({ lang: asLang(input?.lang) }))
  .handler(async ({ data, context }): Promise<{ ok: true; text: string } | { ok: false; reason: AiFailureReason | "empty" }> => {
    const [{ getSql }, store] = await Promise.all([import("./db"), import("./account-store.server")]);
    const { positions } = await store.loadAccount(await getSql(), context.userId);
    if (!positions.length) return { ok: false, reason: "empty" };
    if (!allow(context.userId, "wallet-advice", 6, 180_000)) return { ok: false, reason: "too_often" };
    const { withAiQuota } = await import("./quota.server");
    return withAiQuota(context, "advice", async () => {
      const marketMod = await import("./market.server");
      const { loadCoinContext } = await import("./coin-context.server");
      const tickers = await marketMod.fetchTickers(positions.map((p) => p.symbol));
      const priceOf = new Map(tickers.map((t) => [t.symbol, t.price]));
      const rows = positions.map((p) => {
        const price = priceOf.get(p.symbol) || p.entry;
        return { ...p, price, value: price * p.qty, pnlPct: ((price - p.entry) / p.entry) * 100 };
      });
      const total = rows.reduce((s, r) => s + r.value, 0);
      const cost = rows.reduce((s, r) => s + r.entry * r.qty, 0);
      // Technical read for the largest holdings only — keeps the request fast.
      const top = [...rows].sort((a, b) => b.value - a.value).slice(0, 8);
      const reads = new Map(
        await Promise.all(
          top.map(async (r) => [r.base, await loadCoinContext(r.base, "4h").catch(() => null)] as const),
        ),
      );
      const lines = rows.map((r) => {
        const ctx = reads.get(r.base);
        const days = Math.floor((Date.now() - r.openedAt) / 86_400_000);
        return [
          `${r.base}: qty ${r.qty}, entry ${r.entry}, now ${r.price}, P/L ${r.pnlPct.toFixed(1)}%, held ${days} days,`,
          `share ${total > 0 ? ((r.value / total) * 100).toFixed(1) : "?"}%`,
          ctx ? `, 4h score ${ctx.score} (${ctx.signal}), daily trend ${ctx.higherTf?.trend ?? "?"}` : "",
        ].join(" ");
      });
      const { completeText } = await import("./ai.server");
      const result = await completeText({
        system: WALLET_SYSTEM,
        messages: [
          {
            role: "user",
            text: [
              `Portfolio: ${rows.length} holdings, value ${total.toFixed(2)} USD, total P/L ${cost > 0 ? (((total - cost) / cost) * 100).toFixed(1) : "0"}%.`,
              ...lines,
            ].join("\n"),
          },
        ],
        effort: "medium",
        maxTokens: 8000,
        lang: data.lang,
      });
      return result.ok ? { ok: true, text: result.text } : { ok: false, reason: result.reason };
    });
  });

export const PORTFOLIO_PERIODS = [
  { id: "1d", label: "1д" },
  { id: "10d", label: "10д" },
  { id: "20d", label: "20д" },
  { id: "30d", label: "30д" },
  { id: "1y", label: "1г" },
] as const;
export type PortfolioPeriod = (typeof PORTFOLIO_PERIODS)[number]["id"];

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const PERIOD_SPEC: Record<PortfolioPeriod, { interval: string; limit: number; bucketMs: number }> = {
  "1d": { interval: "1h", limit: 24, bucketMs: HOUR_MS },
  "10d": { interval: "1d", limit: 10, bucketMs: DAY_MS },
  "20d": { interval: "1d", limit: 20, bucketMs: DAY_MS },
  "30d": { interval: "1d", limit: 30, bucketMs: DAY_MS },
  "1y": { interval: "1d", limit: 365, bucketMs: DAY_MS },
};

export type PortfolioPoint = { t: number; value: number };

/**
 * Value of the wallet's CURRENT holdings priced at each historical point — not
 * a record of what was actually owned back then. Simple, and what people expect
 * from a "how has my portfolio moved" chart: current qty × historical close.
 */
export const getPortfolioHistory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { positions?: { symbol?: string; qty?: number }[]; period?: string }) => ({
    positions: (input.positions ?? [])
      .map((p) => ({ symbol: String(p?.symbol ?? "").toUpperCase(), qty: Number(p?.qty ?? 0) }))
      .filter((p) => /^[A-Z0-9=.^-]{2,20}$/.test(p.symbol) && Number.isFinite(p.qty) && p.qty > 0)
      .slice(0, 30),
    period: (PORTFOLIO_PERIODS.some((p) => p.id === input.period) ? input.period : "30d") as PortfolioPeriod,
  }))
  .handler(async ({ data }): Promise<PortfolioPoint[]> => {
    if (!data.positions.length) return [];
    const marketMod = await import("./market.server");
    const { interval, limit, bucketMs } = PERIOD_SPEC[data.period];
    const candleLists = await Promise.all(
      data.positions.map((p) => (p.symbol.endsWith(".CG") ? geckoPoints(p.symbol, data.period) : marketMod.fetchKlines(p.symbol, interval, limit))),
    );
    return portfolioSeries(
      data.positions.map((p, i) => ({ qty: p.qty, candles: candleLists[i] ?? [] })),
      bucketMs,
    );
  });

/** Price history for coins that only CoinGecko knows (added from a coin page), shaped like candles. */
async function geckoPoints(symbol: string, period: PortfolioPeriod): Promise<{ t: number; c: number }[]> {
  const coins = await import("./coins.server");
  const ticker = symbol.replace(/\.CG$/, "");
  const coin = (await coins.getBySymbols([ticker]).catch(() => null))?.coins.find((c) => c.symbol === ticker);
  if (!coin) return [];
  const range = period === "1d" ? "1d" : period === "1y" ? "1y" : "1m";
  const history = await coins.getHistory(coin.id, coin.symbol, range, coin.price).catch(() => null);
  return (history?.points ?? []).map((p) => ({ t: p.t, c: p.c }));
}
