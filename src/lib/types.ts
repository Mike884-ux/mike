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
  /** MACD histogram now minus 3 candles ago: momentum speeding up (>0) or fading. */
  macdHistSlope: number;
  atr: number;
  /** ATR as % of price — how wide a normal candle is. */
  atrPct: number;
  volumeRatio: number;
  trend: "up" | "down" | "side";
  /** Average Directional Index: trend strength, <18 choppy, >25 trending. */
  adx: number;
  plusDI: number;
  minusDI: number;
  /** Position inside Bollinger(20,2): 0 = lower band, 1 = upper band. */
  bbPercentB: number;
  /** Band width as % of the middle band — squeeze when small. */
  bbWidth: number;
  /** Stochastic RSI %K, 0..100. */
  stochK: number;
  /** On-balance volume direction over the last 10 candles. */
  obvTrend: "up" | "down" | "flat";
  /** % change over the last 10 candles. */
  roc10: number;
};

export type FactorKey =
  | "emaStackUp"
  | "emaStackDown"
  | "emaCrossUp"
  | "emaCrossDown"
  | "aboveEma50"
  | "belowEma50"
  | "macdBull"
  | "macdBear"
  | "rsiBull"
  | "rsiBear"
  | "rsiOverbought"
  | "rsiOversold"
  | "stochLow"
  | "stochHigh"
  | "diBull"
  | "diBear"
  | "obvUp"
  | "obvDown"
  | "bbUpper"
  | "bbLower"
  | "adxWeak"
  | "adxStrong"
  | "volumeSpike"
  | "higherTfAgrees"
  | "higherTfAgainst";

/** One reason behind a signal. Positive weight pushes toward LONG, negative toward SHORT. */
export type SignalFactor = { key: FactorKey; weight: number; value?: number };

export type CoinSignal = {
  signal: Signal;
  confidence: number;
  /** -100 (strong short) … +100 (strong long). */
  score: number;
  factors: SignalFactor[];
  /** Russian one-line summary; also fed to the AI as context. */
  reason: string;
};

/** How the same signal rule would have done on this coin's recent history. */
export type Backtest = { trades: number; wins: number; hitRate: number; avgMovePct: number };

export type NewsItem = {
  title: string;
  source: string;
  url: string;
  /** Publication time, ms since epoch, when the feed provides it. */
  publishedAt?: number;
  /** Market mood of the headline, tagged by the AI. */
  tone?: "bull" | "bear" | "neutral";
  /** Tickers the headline is about. */
  bases?: string[];
};

export type AiLevels = {
  direction: Signal;
  confidence: number;
  support?: number;
  resistance?: number;
  entry?: number;
  stopLoss?: number;
  target?: number;
  target2?: number;
  /** Reward-to-risk from entry, stop and first target, computed on the server. */
  riskReward?: number;
  verdict: string;
  summary: string;
  reasons: string[];
  risks: string[];
  bullCase: string;
  bearCase: string;
  invalidation: string;
  horizon: string;
  /** True when the AI and the indicator score point the same way. */
  agreesWithIndicators: boolean;
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
