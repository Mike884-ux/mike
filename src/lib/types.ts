export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type Ticker = {
  symbol: string;
  price: number;
  change24h: number;
};

export type FearGreed = { value: number; label: string };

export type Signal = "LONG" | "SHORT" | "WAIT";

export type Technicals = {
  rsi: number;
  ema9: number;
  ema21: number;
  ema50: number;
  macd: number;
  macdSignal: number;
  atr: number;
  volumeRatio: number;
  trend: "up" | "down" | "side";
};

export type CoinSignal = {
  signal: Signal;
  confidence: number;
  reason: string;
};

export type NewsItem = {
  title: string;
  source: string;
  url: string;
};

export type AiLevels = {
  direction: Signal;
  confidence: number;
  support?: number;
  resistance?: number;
  entry?: number;
  stopLoss?: number;
  target?: number;
  verdict: string;
  reasons: string[];
};

export type Position = {
  id: string;
  base: string;
  symbol: string;
  qty: number;
  entry: number;
  openedAt: number;
};

export const INTERVALS = [
  { id: "15m", label: "15м" },
  { id: "30m", label: "30м" },
  { id: "1h", label: "1ч" },
  { id: "4h", label: "4ч" },
  { id: "1d", label: "1д" },
] as const;

export type IntervalId = (typeof INTERVALS)[number]["id"];

const INTERVAL_IDS: ReadonlySet<string> = new Set(INTERVALS.map((item) => item.id));

/** Coerce untrusted input to a supported timeframe; anything else becomes the 1h default. */
export function asInterval(value: unknown): IntervalId {
  const id = String(value ?? "");
  return (INTERVAL_IDS.has(id) ? id : "1h") as IntervalId;
}
