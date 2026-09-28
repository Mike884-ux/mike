/**
 * Crypto screener: filters over the market listing plus, for the coins the
 * scanner covers, the technical signal. Pure functions — shared by the page
 * and the tests.
 */
import type { MarketCoin } from "./coins";
import type { Signal } from "./types";

export type ScreenTech = {
  signal: Signal;
  score: number;
  confidence: number;
  rsi: number;
  volumeRatio: number;
};

export type ScreenRow = MarketCoin & { tech: ScreenTech | null };

export type Range = { min?: number | null; max?: number | null };

export type SignalFilter = "any" | "long" | "short" | "strong";

export type ScreenFilters = {
  change1h?: Range;
  change24h?: Range;
  change7d?: Range;
  /** USD. */
  marketCap?: Range;
  /** Minimum 24h volume, USD. */
  volumeMin?: number | null;
  /** Unusual activity: daily turnover above 20% of market cap, or volume 1.5× its average. */
  highVolume?: boolean;
  signal?: SignalFilter;
  rsi?: Range;
};

/** A signal counts as strong from this absolute score (the entry threshold is 30). */
export const STRONG_SCORE = 50;
export const HIGH_TURNOVER = 0.2;
export const HIGH_VOLUME_RATIO = 1.5;

export const PRESET_IDS = ["gainers", "losers", "smallCap", "highVolume", "strongSignal", "oversold", "overbought"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export type SortKey = "rank" | "change24h" | "change7d" | "marketCap" | "volume24h" | "score" | "rsi";

export const PRESETS: Record<PresetId, { filters: ScreenFilters; sort: SortKey; dir: "asc" | "desc" }> = {
  gainers: { filters: { change24h: { min: 10 } }, sort: "change24h", dir: "desc" },
  losers: { filters: { change24h: { max: -10 } }, sort: "change24h", dir: "asc" },
  smallCap: { filters: { marketCap: { max: 100_000_000 } }, sort: "marketCap", dir: "desc" },
  highVolume: { filters: { highVolume: true }, sort: "volume24h", dir: "desc" },
  strongSignal: { filters: { signal: "strong" }, sort: "score", dir: "desc" },
  oversold: { filters: { rsi: { max: 30 } }, sort: "rsi", dir: "asc" },
  overbought: { filters: { rsi: { min: 70 } }, sort: "rsi", dir: "desc" },
};

/** Filters that free members can set by hand; everything else is Pro. */
const FREE_KEYS = new Set<keyof ScreenFilters>(["change24h", "marketCap"]);

const hasRange = (r: Range | undefined) => r != null && (isNum(r.min) || isNum(r.max));
const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

function active(f: ScreenFilters, key: keyof ScreenFilters): boolean {
  const v = f[key];
  if (key === "signal") return v !== undefined && v !== "any";
  if (key === "highVolume") return v === true;
  if (key === "volumeMin") return isNum(v as number | null | undefined);
  return hasRange(v as Range | undefined);
}

/** Custom filters beyond the free set — shown locked for free members. */
export function usesProFilters(f: ScreenFilters): boolean {
  return (Object.keys(f) as (keyof ScreenFilters)[]).some((key) => !FREE_KEYS.has(key) && active(f, key));
}

/** True when the filter needs the technical data, which only part of the list has. */
export function needsTech(f: ScreenFilters): boolean {
  return active(f, "signal") || active(f, "rsi");
}

/** A missing value never passes a set bound — "grew 10%" must not match unknown change. */
function inRange(value: number | null | undefined, r: Range | undefined): boolean {
  if (!hasRange(r)) return true;
  if (!isNum(value)) return false;
  if (isNum(r!.min) && value < r!.min) return false;
  if (isNum(r!.max) && value > r!.max) return false;
  return true;
}

export function isHighVolume(row: ScreenRow): boolean {
  const turnover = row.marketCap && row.volume24h ? row.volume24h / row.marketCap : 0;
  return turnover > HIGH_TURNOVER || (row.tech?.volumeRatio ?? 0) > HIGH_VOLUME_RATIO;
}

function signalMatches(tech: ScreenTech | null, want: SignalFilter | undefined): boolean {
  if (!want || want === "any") return true;
  if (!tech) return false;
  if (want === "long") return tech.signal === "LONG";
  if (want === "short") return tech.signal === "SHORT";
  return tech.signal !== "WAIT" && Math.abs(tech.score) >= STRONG_SCORE;
}

export function matches(row: ScreenRow, f: ScreenFilters): boolean {
  return (
    inRange(row.change1h, f.change1h) &&
    inRange(row.change24h, f.change24h) &&
    inRange(row.change7d, f.change7d) &&
    inRange(row.marketCap, f.marketCap) &&
    (!isNum(f.volumeMin) || (row.volume24h ?? 0) >= f.volumeMin) &&
    (!f.highVolume || isHighVolume(row)) &&
    signalMatches(row.tech, f.signal) &&
    (!hasRange(f.rsi) || inRange(row.tech?.rsi, f.rsi))
  );
}

function sortValue(row: ScreenRow, key: SortKey): number | null {
  switch (key) {
    case "score":
      return row.tech ? Math.abs(row.tech.score) : null;
    case "rsi":
      return row.tech?.rsi ?? null;
    default:
      return row[key];
  }
}

/** Filtered and sorted; rows without a value for the sort key go last. */
export function applyScreen(rows: ScreenRow[], f: ScreenFilters, sort: SortKey = "rank", dir: "asc" | "desc" = "asc"): ScreenRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .filter((row) => matches(row, f))
    .sort((a, b) => {
      const x = sortValue(a, sort);
      const y = sortValue(b, sort);
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return (x - y) * sign;
    });
}
