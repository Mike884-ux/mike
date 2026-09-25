/**
 * Pure portfolio-history math. No app imports, so it runs under
 * `node --experimental-strip-types --test` as-is.
 */

export type PricePoint = { t: number; c: number };
export type ValuePoint = { t: number; value: number };

/**
 * Value of `qty` units of each asset at every point in time.
 *
 * Crypto (Binance) and stocks (Yahoo) put their candles at different
 * timestamps, and stocks skip weekends. Summing only exact-timestamp matches
 * made the line jump between "crypto only" and "stocks only" totals. Instead:
 * floor every candle to `bucketMs`, carry each asset's last known close
 * forward, and start the line only once every priced asset has a value, so an
 * asset that "appears" mid-period can't look like a sudden gain.
 */
export function portfolioSeries(
  holdings: { qty: number; candles: PricePoint[] }[],
  bucketMs: number,
): ValuePoint[] {
  const priced = holdings
    .filter((h) => h.qty > 0 && h.candles.length > 0)
    .map((h) => {
      const byBucket = new Map<number, number>();
      for (const candle of [...h.candles].sort((a, b) => a.t - b.t)) {
        if (!Number.isFinite(candle.c)) continue;
        byBucket.set(candle.t - (candle.t % bucketMs), candle.c);
      }
      return { qty: h.qty, byBucket };
    })
    .filter((h) => h.byBucket.size > 0);
  if (!priced.length) return [];

  const times = [...new Set(priced.flatMap((h) => [...h.byBucket.keys()]))].sort((a, b) => a - b);
  const last: (number | undefined)[] = priced.map(() => undefined);
  const out: ValuePoint[] = [];
  for (const t of times) {
    priced.forEach((h, i) => {
      const close = h.byBucket.get(t);
      if (close !== undefined) last[i] = close;
    });
    if (last.some((close) => close === undefined)) continue;
    const value = priced.reduce((sum, h, i) => sum + h.qty * (last[i] ?? 0), 0);
    out.push({ t, value: Number(value.toFixed(2)) });
  }
  return out;
}

/** Parse a user-typed number, accepting a comma as the decimal separator ("0,5"). */
export function parseAmount(raw: string): number {
  const clean = raw.replace(/\s+/g, "").replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(clean)) return Number.NaN;
  return Number(clean);
}

/** Merge a new buy into an existing holding: quantities add, entry becomes the weighted average. */
export function averageIn(
  existing: { qty: number; entry: number },
  added: { qty: number; entry: number },
): { qty: number; entry: number } {
  const qty = existing.qty + added.qty;
  if (qty <= 0) return { qty: 0, entry: added.entry };
  return { qty, entry: (existing.qty * existing.entry + added.qty * added.entry) / qty };
}
