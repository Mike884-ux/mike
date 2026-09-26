/**
 * Market-wide coin data shown on the public pages (listing, coin page, stats
 * bar). Shared by the server (which fills it from CoinGecko, CoinPaprika or
 * Binance) and the browser (which reads it from /api/market/*).
 */

export type DataSource = "coingecko" | "coinpaprika" | "binance";

export type MarketCoin = {
  /** CoinGecko id ("bitcoin") — also the coin page slug. */
  id: string;
  rank: number | null;
  /** Upper-case ticker, e.g. "BTC". */
  symbol: string;
  name: string;
  image: string | null;
  price: number;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCap: number | null;
  volume24h: number | null;
  circulating: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  fdv: number | null;
  /** Last 7 days of prices, oldest first, thinned to a few dozen points. Empty when unknown. */
  spark: number[];
};

export type ListingResponse = {
  coins: MarketCoin[];
  source: DataSource;
  page: number;
  updatedAt: number;
};

export type GlobalStats = {
  coins: number | null;
  markets: number | null;
  marketCap: number | null;
  marketCapChange24h: number | null;
  volume24h: number | null;
  btcDominance: number | null;
  ethDominance: number | null;
  fearGreed: { value: number; label: string } | null;
  source: DataSource | null;
  updatedAt: number;
};

export type TrendingCoin = {
  id: string;
  name: string;
  symbol: string;
  image: string | null;
  rank: number | null;
  price: number | null;
  change24h: number | null;
};

export type CoinLinks = {
  homepage: string | null;
  whitepaper: string | null;
  explorers: string[];
  github: string | null;
  twitter: string | null;
  reddit: string | null;
  telegram: string | null;
};

export type CoinInfo = MarketCoin & {
  high24h: number | null;
  low24h: number | null;
  change30d: number | null;
  change1y: number | null;
  ath: number | null;
  athDate: string | null;
  athChange: number | null;
  atl: number | null;
  atlDate: string | null;
  atlChange: number | null;
  /** Plain text (HTML stripped on the server), in the requested language when CoinGecko has it. */
  description: string;
  categories: string[];
  links: CoinLinks;
  genesisDate: string | null;
  source: DataSource;
  updatedAt: number;
};

export type HistoryPoint = { t: number; o: number; h: number; l: number; c: number; v: number };

export type HistoryResponse = {
  /** Binance gives real candles; CoinGecko gives one price per step (o = h = l = c). */
  source: "binance" | "coingecko";
  points: HistoryPoint[];
};

export type SearchHit = { id: string; name: string; symbol: string; rank: number | null; image: string | null };

export const RANGES = [
  { id: "1d", days: 1 },
  { id: "7d", days: 7 },
  { id: "1m", days: 30 },
  { id: "3m", days: 90 },
  { id: "1y", days: 365 },
  { id: "all", days: 0 },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];

export function asRange(value: unknown): RangeId {
  return RANGES.some((r) => r.id === value) ? (value as RangeId) : "7d";
}

/** CoinGecko category ids behind the listing's category tabs. */
export const CATEGORIES = [
  { id: "artificial-intelligence", key: "cat.ai" },
  { id: "meme-token", key: "cat.meme" },
  { id: "decentralized-finance-defi", key: "cat.defi" },
  { id: "layer-1", key: "cat.l1" },
  { id: "real-world-assets-rwa", key: "cat.rwa" },
  { id: "gaming", key: "cat.gaming" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function asCategory(value: unknown): CategoryId | undefined {
  return CATEGORIES.find((c) => c.id === value)?.id;
}

export const PAGE_SIZE = 100;
export const MAX_PAGES = 10;

/** Coin page slug check: CoinGecko ids are lower-case words joined by dashes. */
export function isCoinId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,79}$/.test(value);
}

export class MarketError extends Error {
  constructor(readonly status: number) {
    super(`market ${status}`);
    this.name = "MarketError";
  }
}

/** Browser-side reader for /api/market/*. Throws on failure so react-query can retry. */
export async function marketGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new MarketError(res.status);
  return (await res.json()) as T;
}
