/** Market scan shared by /signals, the screener and alerts — **server-only**. */
import { computeTechnicals, technicalSignal } from "./indicators";
import { assetOf, symbolOf, TAPE_CRYPTOS, TAPE_STOCKS } from "./markets";
import type { CoinRow } from "./scan";
import type { Candle, IntervalId, Signal } from "./types";

const UNIVERSE = [...TAPE_CRYPTOS, ...TAPE_STOCKS];

const scanCache = new Map<string, { at: number; value: CoinRow[] }>();
const inflight = new Map<string, Promise<CoinRow[]>>();
const SCAN_TTL = 20_000;

/** Signals for the whole tape; concurrent callers share one run. */
export async function runScan(interval: IntervalId): Promise<CoinRow[]> {
  const hit = scanCache.get(interval);
  if (hit && Date.now() - hit.at < SCAN_TTL) return hit.value;
  const running = inflight.get(interval);
  if (running) return running;
  const job = scan(interval).finally(() => inflight.delete(interval));
  inflight.set(interval, job);
  return job;
}

/** The last scan if it is still fresh enough for a quick answer (the bot must not wait 30 s). */
export function peekScan(interval: IntervalId, maxAgeMs = 10 * 60_000): CoinRow[] | null {
  const hit = scanCache.get(interval);
  return hit && Date.now() - hit.at < maxAgeMs ? hit.value : null;
}

async function scan(interval: IntervalId): Promise<CoinRow[]> {
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
    const results = await Promise.all(batch.map((symbol) => marketMod.fetchKlines(symbol, interval, 100)));
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
      score: verdict.score,
      volumeRatio: tech.volumeRatio,
      adx: tech.adx,
      spark: candles.slice(-40).map((c) => Number(c.c.toPrecision(6))),
    });
  });

  rows.sort((a, b) => {
    const rank = (s: Signal) => (s === "WAIT" ? 0 : 1);
    if (rank(a.signal) !== rank(b.signal)) return rank(b.signal) - rank(a.signal);
    return Math.abs(b.score) - Math.abs(a.score);
  });

  // Don't cache a mostly-empty result — a bad network window shouldn't force
  // everyone to see "market not responding" for the full TTL once it recovers.
  if (rows.length >= symbols.length / 2) {
    scanCache.set(interval, { at: Date.now(), value: rows });
  }
  return rows;
}
