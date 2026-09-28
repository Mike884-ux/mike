import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { AssetKind } from "./markets";
import { asInterval, type FearGreed, type Signal } from "./types";

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
  score: number;
  volumeRatio: number;
  adx: number;
  /**
   * Last 40 closes for the row's mini chart. The rows used to carry 60 full
   * candles each plus signal factors: ~1.5 MB every refresh, which made the
   * page stutter on phones and slow connections. This is ~30× smaller.
   */
  spark: number[];
};

export const scanMarket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { interval?: string }) => ({
    interval: asInterval(input.interval),
  }))
  .handler(async ({ data }): Promise<CoinRow[]> => {
    const { runScan } = await import("./scan.server");
    return runScan(data.interval);
  });

export const getSentiment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async (): Promise<FearGreed | null> => {
    const marketMod = await import("./market.server");
    const fng = await marketMod.fetchFearGreed();
    return fng ?? null;
  });
