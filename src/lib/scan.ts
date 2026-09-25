import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { computeTechnicals, technicalSignal } from "./indicators";
import { assetOf, symbolOf, TAPE_CRYPTOS, TAPE_STOCKS } from "./markets";
import type { AssetKind } from "./markets";
import { asInterval, type Candle, type FearGreed, type Signal } from "./types";

export type CoinRow = {
  symbol: string;
  base: string;
  kind: AssetKind;
  price: number;
  change24h: number;
  rsi: number;
  trend: "up" | "down" | "side";
  signal: Signal;
  confidence: number;
  reason: string;
  candles: Candle[];
};

const UNIVERSE = [...TAPE_CRYPTOS, ...TAPE_STOCKS];

const scanCache = new Map<string, { at: number; value: CoinRow[] }>();
const SCAN_TTL = 20_000;

export const scanMarket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { interval?: string }) => ({
    interval: asInterval(input.interval),
  }))
  .handler(async ({ data }): Promise<CoinRow[]> => {
    const cacheKey = data.interval;
    const hit = scanCache.get(cacheKey);
    if (hit && Date.now() - hit.at < SCAN_TTL) return hit.value;

    const marketMod = await import("./market.server");
    const symbols = UNIVERSE.map((base) => symbolOf(assetOf(base)!));

    // Runs alongside the klines loop below instead of after it — halves the
    // worst-case total time under a slow network.
    const tickersPromise = marketMod.fetchTickers(symbols);

    // Fetch klines in modest batches with a short gap between waves — bursting
    // 40+ simultaneous connections at one host trips rate limiting far more
    // than a handful of slower, spaced-out waves. A hard overall deadline
    // means a run of slow/timed-out symbols degrades to a partial result
    // instead of the whole request hanging until something upstream aborts it.
    const BATCH = 6;
    const DEADLINE_MS = 32_000;
    const startedAt = Date.now();
    const klineLists: Candle[][] = [];
    let empty = 0;
    for (let i = 0; i < symbols.length; i += BATCH) {
      if (Date.now() - startedAt > DEADLINE_MS) {
        console.error(`[scan] hit ${DEADLINE_MS}ms deadline after ${klineLists.length}/${symbols.length} symbols — returning partial results`);
        break;
      }
      const batch = symbols.slice(i, i + BATCH);
      const results = await Promise.all(batch.map((symbol) => marketMod.fetchKlines(symbol, data.interval, 60)));
      empty += results.filter((r) => r.length === 0).length;
      klineLists.push(...results);
      if (i + BATCH < symbols.length) await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (empty > 0) console.error(`[scan] ${empty}/${symbols.length} klines fetches returned empty`);
    const tickers = await tickersPromise;
    const priceBySymbol = new Map(tickers.map((t) => [t.symbol, t]));

    const rows: CoinRow[] = [];
    UNIVERSE.forEach((base, i) => {
      const symbol = symbols[i]!;
      const candles = klineLists[i] ?? [];
      if (candles.length < 20) return;
      const ticker = priceBySymbol.get(symbol);
      const price = ticker?.price || candles.at(-1)?.c || 0;
      if (!price) return;
      const tech = computeTechnicals(candles);
      const verdict = technicalSignal(tech);
      rows.push({
        symbol,
        base,
        kind: assetOf(base)?.kind ?? "crypto",
        price,
        change24h: ticker?.change24h ?? 0,
        rsi: tech.rsi,
        trend: tech.trend,
        signal: verdict.signal,
        confidence: verdict.confidence,
        reason: verdict.reason,
        candles: candles.slice(-60),
      });
    });

    rows.sort((a, b) => {
      const rank = (s: Signal) => (s === "WAIT" ? 0 : 1);
      if (rank(a.signal) !== rank(b.signal)) return rank(b.signal) - rank(a.signal);
      return b.confidence - a.confidence;
    });

    // Don't cache a mostly-empty result — a bad network window shouldn't force
    // everyone to see "market not responding" for the full TTL once it recovers.
    if (rows.length >= symbols.length / 2) {
      scanCache.set(cacheKey, { at: Date.now(), value: rows });
    }
    return rows;
  });

export const getSentiment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async (): Promise<FearGreed | null> => {
    const marketMod = await import("./market.server");
    const fng = await marketMod.fetchFearGreed();
    return fng ?? null;
  });
