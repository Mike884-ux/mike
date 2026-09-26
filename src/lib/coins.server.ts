/**
 * Market-wide data for the public pages — **server-only**.
 *
 * CoinGecko is the main source (caps, supply, logos, 7-day sparklines).
 * CoinPaprika stands in when CoinGecko is down or rate-limits us, and the
 * Binance tape is the last resort for the first page. Every answer is cached
 * in memory; when an upstream fails, the last good answer is served for a
 * while instead of an error. Price history comes from Binance candles when
 * the coin trades there (reliable, no quota) and from CoinGecko otherwise.
 */
import {
  historyFromCgChart,
  historyFromKlines,
  infoFromMarket,
  mapCgCoin,
  mapCgGlobal,
  mapCgMarket,
  mapCgSearch,
  mapCgTrending,
  mapPaprikaGlobal,
  mapPaprikaTicker,
} from "./coins-map";
import {
  PAGE_SIZE,
  RANGES,
  type CategoryId,
  type CoinInfo,
  type GlobalStats,
  type HistoryResponse,
  type ListingResponse,
  type MarketCoin,
  type RangeId,
  type SearchHit,
  type TrendingCoin,
} from "./coins";
import type { Lang } from "./lang";
import { assetOf, TAPE_CRYPTOS } from "./markets";

const CG_PRO_KEY = process.env.COINGECKO_PRO_API_KEY?.trim();
const CG_DEMO_KEY = process.env.COINGECKO_API_KEY?.trim();
const CG_BASE = CG_PRO_KEY ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
const PAPRIKA = "https://api.coinpaprika.com/v1";
const BINANCE = ["https://data-api.binance.vision", "https://api.binance.com"];

const UA = "Mozilla/5.0 (compatible; ScanMarket/1.0)";

type Upstream = { ok: true; status: number; data: unknown } | { ok: false; status: number };

async function getJson(url: string, headers: Record<string, string> = {}, timeoutMs = 8000): Promise<Upstream> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json", "User-Agent": UA, ...headers },
    });
    if (!res.ok) {
      console.error(`[coins] HTTP ${res.status} ${url.replace(/\?.*/, "")}`);
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status, data: await res.json() };
  } catch (error) {
    console.error(`[coins] ${url.replace(/\?.*/, "")}: ${error instanceof Error ? error.message : error}`);
    return { ok: false, status: 0 };
  }
}

/**
 * After a 429 CoinGecko is left alone for a minute: hammering it only extends
 * the ban, and the fallbacks answer faster than a request that will fail.
 */
let cgPausedUntil = 0;

async function coingecko(path: string): Promise<Upstream> {
  if (Date.now() < cgPausedUntil) return { ok: false, status: 429 };
  const headers: Record<string, string> = CG_PRO_KEY
    ? { "x-cg-pro-api-key": CG_PRO_KEY }
    : CG_DEMO_KEY
      ? { "x-cg-demo-api-key": CG_DEMO_KEY }
      : {};
  const res = await getJson(`${CG_BASE}${path}`, headers);
  if (!res.ok && res.status === 429) cgPausedUntil = Date.now() + 60_000;
  return res;
}

async function paprika(path: string): Promise<unknown | null> {
  const res = await getJson(`${PAPRIKA}${path}`, {}, 10_000);
  return res.ok ? res.data : null;
}

async function binance(path: string): Promise<unknown | null> {
  const jobs = BINANCE.map(async (host) => {
    const res = await getJson(`${host}${path}`, {}, 6000);
    if (!res.ok) throw new Error(String(res.status));
    return res.data;
  });
  try {
    return await Promise.any(jobs);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cache: fresh for `ttl`, then refreshed; if the refresh fails, the previous
// value keeps being served for up to `staleMs`.

type Entry = { at: number; value?: unknown; inflight?: Promise<unknown> };
const store = new Map<string, Entry>();
const STORE_MAX = 400;

function prune() {
  if (store.size <= STORE_MAX) return;
  const byAge = [...store.entries()].filter(([, e]) => !e.inflight).sort((a, b) => a[1].at - b[1].at);
  for (const [key] of byAge.slice(0, store.size - STORE_MAX)) store.delete(key);
}

async function cached<T>(key: string, ttl: number, load: () => Promise<T | null>, staleMs = 30 * 60_000): Promise<T | null> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit?.value !== undefined && now - hit.at < ttl) return hit.value as T;
  if (hit?.inflight) return hit.inflight as Promise<T | null>;
  const previous = hit?.value !== undefined ? { at: hit.at, value: hit.value as T } : null;
  const inflight = load()
    .catch((error) => {
      console.error(`[coins] ${key}: ${error instanceof Error ? error.message : error}`);
      return null;
    })
    .then((value) => {
      if (value !== null && value !== undefined) {
        store.set(key, { at: Date.now(), value });
        prune();
        return value;
      }
      if (previous && Date.now() - previous.at < staleMs) {
        store.set(key, { at: previous.at, value: previous.value });
        return previous.value;
      }
      store.delete(key);
      return null;
    });
  store.set(key, { at: previous?.at ?? 0, value: previous?.value, inflight });
  return inflight;
}

function peek<T>(key: string): T | undefined {
  return store.get(key)?.value as T | undefined;
}

// ---------------------------------------------------------------------------
// Listing

const MARKETS_QUERY = "vs_currency=usd&order=market_cap_desc&sparkline=true&price_change_percentage=1h%2C24h%2C7d";

function mapCgList(data: unknown): MarketCoin[] {
  return (Array.isArray(data) ? data : []).map(mapCgMarket).filter((c): c is MarketCoin => c !== null);
}

/** The whole CoinPaprika board (~2,500 coins, rank order) — one call serves every page. */
async function paprikaBoard(): Promise<MarketCoin[] | null> {
  return cached("paprika:tickers", 120_000, async () => {
    const data = await paprika("/tickers?quotes=USD");
    const coins = (Array.isArray(data) ? data : [])
      .map(mapPaprikaTicker)
      .filter((c): c is MarketCoin => c !== null && (c.rank ?? 0) > 0)
      .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
    return coins.length ? coins : null;
  });
}

const COINCAP_ICON = (symbol: string) => `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;

/** Last resort for page 1: the Binance spot tape the scanner already follows. */
async function binanceBoard(): Promise<MarketCoin[] | null> {
  const symbols = TAPE_CRYPTOS.map((base) => assetOf(base)?.binance).filter((s): s is string => Boolean(s));
  const data = await binance(`/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`);
  if (!Array.isArray(data)) return null;
  const coins: MarketCoin[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    const pair = String(raw.symbol ?? "");
    const base = pair.replace(/USDT$/, "");
    const price = Number(raw.lastPrice);
    if (!base || !(price > 0)) continue;
    coins.push({
      id: base.toLowerCase(),
      rank: null,
      symbol: base,
      name: base,
      image: COINCAP_ICON(base),
      price,
      change1h: null,
      change24h: Number(raw.priceChangePercent) || 0,
      change7d: null,
      marketCap: null,
      volume24h: Number(raw.quoteVolume) || null,
      circulating: null,
      totalSupply: null,
      maxSupply: null,
      fdv: null,
      spark: [],
    });
  }
  coins.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  coins.forEach((coin, i) => (coin.rank = i + 1));
  return coins.length ? coins : null;
}

export async function getListing(page: number, category?: CategoryId): Promise<ListingResponse | null> {
  return cached(`listing:${page}:${category ?? "all"}`, 60_000, async () => {
    const categoryQuery = category ? `&category=${encodeURIComponent(category)}` : "";
    const cg = await coingecko(`/coins/markets?${MARKETS_QUERY}&per_page=${PAGE_SIZE}&page=${page}${categoryQuery}`);
    if (cg.ok) {
      const coins = mapCgList(cg.data);
      // An empty later page is a real answer (past the end), not an outage.
      if (coins.length || page > 1 || category) return { coins, source: "coingecko", page, updatedAt: Date.now() };
    }
    if (category) return null;
    const board = await paprikaBoard();
    if (board?.length) {
      return { coins: board.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), source: "coinpaprika", page, updatedAt: Date.now() };
    }
    if (page === 1) {
      const tape = await binanceBoard();
      if (tape) return { coins: tape, source: "binance", page, updatedAt: Date.now() };
    }
    return null;
  });
}

/** Watchlist rows by ticker, wherever they rank. */
export async function getBySymbols(symbols: string[]): Promise<ListingResponse | null> {
  const wanted = [...new Set(symbols.map((s) => s.toUpperCase()))].sort();
  if (!wanted.length) return { coins: [], source: "coingecko", page: 1, updatedAt: Date.now() };
  return cached(`symbols:${wanted.join(",")}`, 60_000, async () => {
    const list = encodeURIComponent(wanted.map((s) => s.toLowerCase()).join(","));
    const cg = await coingecko(`/coins/markets?${MARKETS_QUERY}&symbols=${list}&include_tokens=top&per_page=250&page=1`);
    if (cg.ok) {
      const coins = mapCgList(cg.data);
      if (coins.length) return { coins, source: "coingecko", page: 1, updatedAt: Date.now() };
    }
    const board = (await paprikaBoard()) ?? [];
    const picked: MarketCoin[] = [];
    for (const symbol of wanted) {
      const coin = board.find((c) => c.symbol === symbol);
      if (coin) picked.push(coin);
    }
    return picked.length ? { coins: picked, source: "coinpaprika", page: 1, updatedAt: Date.now() } : null;
  });
}

/** A coin from any listing already in memory (used when the coin endpoint itself is unavailable). */
function findListed(id: string): { coin: MarketCoin; source: ListingResponse["source"] } | null {
  for (const [key, entry] of store) {
    if (!key.startsWith("listing:") && !key.startsWith("symbols:")) continue;
    const listing = entry.value as ListingResponse | undefined;
    const coin = listing?.coins.find((c) => c.id === id);
    if (coin && listing) return { coin, source: listing.source };
  }
  const board = peek<MarketCoin[]>("paprika:tickers");
  const coin = board?.find((c) => c.id === id);
  return coin ? { coin, source: "coinpaprika" } : null;
}

// ---------------------------------------------------------------------------
// Global stats, trending

export async function getGlobal(): Promise<GlobalStats | null> {
  return cached("global", 120_000, async () => {
    const [cg, fng] = await Promise.all([
      coingecko("/global"),
      import("./market.server").then((m) => m.fetchFearGreed()).catch(() => undefined),
    ]);
    let base = cg.ok ? mapCgGlobal(cg.data) : null;
    if (!base) {
      const data = await paprika("/global");
      base = data ? mapPaprikaGlobal(data) : null;
    }
    if (!base && !fng) return null;
    return {
      coins: null,
      markets: null,
      marketCap: null,
      marketCapChange24h: null,
      volume24h: null,
      btcDominance: null,
      ethDominance: null,
      source: null,
      ...base,
      fearGreed: fng ?? null,
      updatedAt: Date.now(),
    };
  });
}

export async function getTrending(): Promise<TrendingCoin[] | null> {
  return cached("trending", 300_000, async () => {
    const cg = await coingecko("/search/trending");
    const coins = cg.ok ? mapCgTrending(cg.data).slice(0, 10) : [];
    return coins.length ? coins : null;
  });
}

// ---------------------------------------------------------------------------
// One coin

export type CoinLookup = { info: CoinInfo } | { notFound: true };

export async function getCoin(id: string, lang: Lang): Promise<CoinLookup | null> {
  // CoinGecko only localizes descriptions (Russian is the one our users read).
  const descLang = lang === "ru" || lang === "tg" ? "ru" : "en";
  return cached(`coin:${id}:${descLang}`, 120_000, async (): Promise<CoinLookup | null> => {
    const cg = await coingecko(
      `/coins/${encodeURIComponent(id)}?localization=${descLang === "ru"}&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
    );
    if (cg.ok) {
      const info = mapCgCoin(cg.data, lang);
      if (info) return { info };
    }
    if (cg.status === 404 && !findListed(id)) return { notFound: true };
    const listed = findListed(id);
    if (listed) return { info: infoFromMarket(listed.coin, listed.source) };
    const board = await paprikaBoard();
    const coin = board?.find((c) => c.id === id);
    if (coin) return { info: infoFromMarket(coin, "coinpaprika") };
    return null;
  });
}

// ---------------------------------------------------------------------------
// Price history

const BINANCE_RANGE: Record<RangeId, { interval: string; limit: number }> = {
  "1d": { interval: "15m", limit: 96 },
  "7d": { interval: "1h", limit: 168 },
  "1m": { interval: "4h", limit: 180 },
  "3m": { interval: "12h", limit: 180 },
  "1y": { interval: "1d", limit: 365 },
  all: { interval: "1w", limit: 1000 },
};

/** Every Binance spot price, to know which coins trade there (refreshed every few minutes). */
async function binancePrices(): Promise<Map<string, number> | null> {
  return cached("binance:prices", 300_000, async () => {
    const data = await binance("/api/v3/ticker/price");
    if (!Array.isArray(data)) return null;
    const map = new Map<string, number>();
    for (const row of data as { symbol?: string; price?: string }[]) {
      const price = Number(row.price);
      if (row.symbol && price > 0) map.set(row.symbol, price);
    }
    return map.size ? map : null;
  });
}

/**
 * The Binance USDT pair for a coin, if it trades there and its price agrees
 * with the coin's market price (the same ticker can mean different coins).
 */
async function binancePair(symbol: string, refPrice: number | null): Promise<string | null> {
  if (!/^[A-Z0-9]{2,15}$/.test(symbol)) return null;
  const prices = await binancePrices();
  const pair = `${symbol}USDT`;
  const price = prices?.get(pair);
  if (!price) return null;
  if (refPrice && Math.abs(price - refPrice) / refPrice > 0.15) return null;
  return pair;
}

export async function getHistory(id: string, symbol: string, range: RangeId, refPrice: number | null): Promise<HistoryResponse | null> {
  const ttl = range === "1d" ? 60_000 : range === "7d" ? 300_000 : 30 * 60_000;
  return cached(`history:${id}:${symbol}:${range}`, ttl, async () => {
    const known = findListed(id)?.coin.price ?? null;
    const pair = await binancePair(symbol, known ?? refPrice);
    if (pair) {
      const { interval, limit } = BINANCE_RANGE[range];
      const rows = await binance(`/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`);
      const points = historyFromKlines(rows);
      if (points.length >= 10) return { source: "binance" as const, points };
    }
    const days = RANGES.find((r) => r.id === range)?.days || "max";
    const cg = await coingecko(`/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`);
    if (cg.ok) {
      const points = historyFromCgChart(cg.data);
      if (points.length >= 2) return { source: "coingecko" as const, points };
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// Search

function localHits(needle: string): SearchHit[] {
  const alias = assetOf(needle)?.base.toLowerCase();
  const seen = new Set<string>();
  const hits: (SearchHit & { score: number })[] = [];
  for (const [key, entry] of store) {
    if (!key.startsWith("listing:")) continue;
    for (const coin of (entry.value as ListingResponse | undefined)?.coins ?? []) {
      if (seen.has(coin.id)) continue;
      const symbol = coin.symbol.toLowerCase();
      const name = coin.name.toLowerCase();
      const score =
        symbol === needle || symbol === alias ? 0 : name === needle ? 1 : symbol.startsWith(needle) ? 2 : name.startsWith(needle) ? 3 : name.includes(needle) || coin.id.includes(needle) ? 4 : -1;
      if (score < 0) continue;
      seen.add(coin.id);
      hits.push({ id: coin.id, name: coin.name, symbol: coin.symbol, rank: coin.rank, image: coin.image, score });
    }
  }
  return hits
    .sort((a, b) => a.score - b.score || (a.rank ?? 1e9) - (b.rank ?? 1e9))
    .map(({ score: _score, ...hit }) => hit);
}

export async function searchCoins(query: string): Promise<SearchHit[]> {
  const needle = query.trim().toLowerCase().slice(0, 40);
  if (!needle) return [];
  await getListing(1);
  const local = localHits(needle);
  if (local.length >= 8 || needle.length < 2) return local.slice(0, 8);
  const remote =
    (await cached(`search:${needle}`, 10 * 60_000, async () => {
      const cg = await coingecko(`/search?query=${encodeURIComponent(needle)}`);
      return cg.ok ? mapCgSearch(cg.data).slice(0, 12) : null;
    })) ?? [];
  const merged = [...local];
  for (const hit of remote) if (!merged.some((m) => m.id === hit.id)) merged.push(hit);
  return merged.slice(0, 8);
}
