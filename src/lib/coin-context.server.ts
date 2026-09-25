/**
 * Everything the site knows about one coin on one timeframe — **server-only**.
 * Shared by the chart view and the AI analysis, so the AI always reasons over
 * the same numbers the user sees (computed here, never taken from the browser).
 */
import { backtestSignals, computeTechnicals, technicalSignal } from "./indicators";
import { assetOf, symbolOf } from "./markets";
import type { Backtest, Candle, CoinSignal, IntervalId, Technicals } from "./types";

export const HIGHER_TF: Record<IntervalId, string> = {
  "15m": "1h",
  "30m": "4h",
  "1h": "4h",
  "4h": "1d",
  "1d": "1w",
};

export type CoinContext = CoinSignal & {
  base: string;
  symbol: string;
  price: number;
  change24h: number;
  technicals: Technicals;
  higherTf: { interval: string; trend: Technicals["trend"] } | null;
  backtest: Backtest;
  candles: Candle[];
};

export async function loadCoinContext(base: string, interval: IntervalId): Promise<CoinContext | null> {
  const asset = assetOf(base);
  if (!asset) return null;
  const marketMod = await import("./market.server");
  const symbol = symbolOf(asset);
  const higherInterval = HIGHER_TF[interval];
  const load = () =>
    Promise.all([
      marketMod.fetchKlines(symbol, interval, 300),
      marketMod.fetchTickers([symbol]),
      marketMod.fetchKlines(symbol, higherInterval, 120).catch(() => [] as Candle[]),
    ]);
  let [candles, tickers, higher] = await load();
  // A flaky network hop can starve a single fetch — worth one retry.
  if (candles.length < 30) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    [candles, tickers, higher] = await load();
  }
  if (candles.length < 30) return null;
  const ticker = tickers[0];
  const price = ticker?.price || candles.at(-1)?.c || 0;
  if (!price) return null;

  const technicals = computeTechnicals(candles);
  const higherTrend = higher.length >= 30 ? computeTechnicals(higher).trend : undefined;
  const verdict = technicalSignal(technicals, higherTrend);
  return {
    ...verdict,
    base: asset.base,
    symbol,
    price,
    change24h: ticker?.change24h ?? 0,
    technicals,
    higherTf: higherTrend ? { interval: higherInterval, trend: higherTrend } : null,
    backtest: backtestSignals(candles),
    candles: candles.slice(-150),
  };
}
