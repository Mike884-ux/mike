import { assetOf } from "./markets";
import type { Candle, FearGreed, Ticker } from "./types";

/** Stock/metal assets are quoted via Yahoo Finance instead of Binance. */
function stockAssetOf(symbol: string) {
  const asset = assetOf(symbol.replace(/(USDT|USD|RUB)$/, "")) ?? assetOf(symbol);
  return asset?.yahoo && !asset.binance ? asset : undefined;
}

export type LiveTicker = Ticker & { high24h?: number; low24h?: number; volume?: number };

const BINANCE = ["https://data-api.binance.vision", "https://api.binance.com"];

const KLINE_TTL = 12_000;
const TICKER_TTL = 15_000;
const FNG_TTL = 60_000;

type Memo = { at: number; value: unknown; inflight?: Promise<unknown> };
const memo = new Map<string, Memo>();
const MEMO_MAX = 200;

function pruneMemo() {
  if (memo.size <= MEMO_MAX) return;
  const now = Date.now();
  for (const [key, entry] of memo) {
    if (entry.inflight) continue;
    if (now - entry.at > 60_000) memo.delete(key);
    if (memo.size <= MEMO_MAX) return;
  }
}

async function once<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit?.inflight) return hit.inflight as Promise<T>;
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  const inflight = load()
    .then((value) => {
      memo.set(key, { at: Date.now(), value });
      pruneMemo();
      return value;
    })
    .catch((err) => {
      memo.delete(key);
      throw err;
    });
  memo.set(key, { at: hit?.at ?? 0, value: hit?.value, inflight });
  return inflight;
}

async function getJson<T>(url: string, timeoutMs = 5000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      console.error(`[market] HTTP ${res.status} for ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[market] fetch failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function binanceJson<T>(path: string): Promise<T | null> {
  const jobs = BINANCE.map((host) => getJson<T>(`${host}${path}`, 5000));
  try {
    return await Promise.any(
      jobs.map(async (job) => {
        const data = await job;
        if (!data) throw new Error("empty");
        return data;
      }),
    );
  } catch {
    return null;
  }
}

type RawKline = [number, string, string, string, string, string, number, string, number, string, string, string];

function klineToCandle(row: RawKline): Candle {
  return {
    t: row[0],
    o: Number(row[1]),
    h: Number(row[2]),
    l: Number(row[3]),
    c: Number(row[4]),
    v: Number(row[5]),
  };
}

const YAHOO_INTERVAL: Record<string, { interval: string; range: string }> = {
  "15m": { interval: "15m", range: "1mo" },
  "30m": { interval: "30m", range: "1mo" },
  "1h": { interval: "60m", range: "3mo" },
  "4h": { interval: "60m", range: "6mo" },
  "1d": { interval: "1d", range: "1y" },
  "1w": { interval: "1wk", range: "5y" },
};

function foldTo4h(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += 4) {
    const slice = candles.slice(i, i + 4);
    const first = slice[0];
    if (!first) continue;
    const last = slice.at(-1)!;
    out.push({
      t: first.t,
      o: first.o,
      h: Math.max(...slice.map((c) => c.h)),
      l: Math.min(...slice.map((c) => c.l)),
      c: last.c,
      v: slice.reduce((s, c) => s + c.v, 0),
    });
  }
  return out;
}

async function fetchYahooKlines(ticker: string, interval: string, limit: number, rangeOverride?: string): Promise<Candle[]> {
  const spec = YAHOO_INTERVAL[interval] ?? YAHOO_INTERVAL["1h"]!;
  const range = rangeOverride ?? spec.range;
  const hosts = ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"];
  let json: {
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: { quote?: { open?: number[]; high?: number[]; low?: number[]; close?: number[]; volume?: number[] }[] };
      }[];
    };
  } | null = null;
  for (const host of hosts) {
    json = await getJson(`${host}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${spec.interval}&range=${range}`);
    if (json?.chart?.result?.[0]) break;
  }
  const result = json?.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const q = result?.indicators?.quote?.[0];
  if (!q || !ts.length) return [];
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (![o, h, l, c].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    candles.push({ t: ts[i]! * 1000, o: o!, h: h!, l: l!, c: c!, v: q.volume?.[i] ?? 0 });
  }
  const folded = interval === "4h" ? foldTo4h(candles) : candles;
  return folded.slice(-limit);
}

async function loadYahooTicker(symbol: string): Promise<LiveTicker | null> {
  const stock = stockAssetOf(symbol);
  if (!stock?.yahoo) return null;
  // "5d" instead of the chart's "1y" — a full year of daily bars is unnecessary
  // weight for just today's price/high/low and made this call timeout-prone.
  let day = await fetchYahooKlines(stock.yahoo, "1d", 5, "5d");
  if (!day.length) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    day = await fetchYahooKlines(stock.yahoo, "1d", 5, "5d");
  }
  const last = day.at(-1);
  if (!last) return null;
  const prev = day.at(-2)?.c ?? last.c;
  const ticker: LiveTicker = {
    symbol,
    price: last.c,
    change24h: prev > 0 ? ((last.c - prev) / prev) * 100 : 0,
    high24h: last.h,
    low24h: last.l,
    volume: last.v,
  };
  memo.set(`t:${symbol}`, { at: Date.now(), value: ticker });
  pruneMemo();
  return ticker;
}

export async function fetchKlines(symbol: string, interval: string, limit = 64): Promise<Candle[]> {
  if (symbol.endsWith(".CG")) return []; // no exchange history for CoinGecko-only coins
  return once(`k:${symbol}:${interval}:${limit}`, KLINE_TTL, async () => {
    const stock = stockAssetOf(symbol);
    if (stock?.yahoo) return fetchYahooKlines(stock.yahoo, interval, limit);
    const data = await binanceJson<RawKline[]>(
      `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`,
    );
    if (!Array.isArray(data)) return [];
    return data.map(klineToCandle);
  });
}

async function fillBinanceTickers(symbols: string[], found: Map<string, LiveTicker>) {
  const batch = await binanceJson<
    { symbol?: string; lastPrice?: string; priceChangePercent?: string; highPrice?: string; lowPrice?: string; quoteVolume?: string }[]
  >(`/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`);
  const apply = (
    symbol: string,
    row: { lastPrice?: string; priceChangePercent?: string; highPrice?: string; lowPrice?: string; quoteVolume?: string },
  ) => {
    const ticker: LiveTicker = {
      symbol,
      price: Number(row.lastPrice ?? 0),
      change24h: Number(row.priceChangePercent ?? 0),
      high24h: Number(row.highPrice ?? 0) || undefined,
      low24h: Number(row.lowPrice ?? 0) || undefined,
      volume: Number(row.quoteVolume ?? 0) || undefined,
    };
    memo.set(`t:${symbol}`, { at: Date.now(), value: ticker });
    found.set(symbol, ticker);
    pruneMemo();
  };
  if (Array.isArray(batch) && batch.length) {
    for (const row of batch) {
      if (!row.symbol) continue;
      apply(row.symbol, row);
    }
    return;
  }
  await Promise.all(
    symbols.map(async (symbol) => {
      const row = await binanceJson<{
        lastPrice?: string;
        priceChangePercent?: string;
        highPrice?: string;
        lowPrice?: string;
        quoteVolume?: string;
      }>(`/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
      if (!row) return;
      apply(symbol, row);
    }),
  );
}

/** Wallet symbols like "PEPE.CG" belong to coins we don't follow on an exchange; CoinGecko quotes them. */
async function fetchGeckoTickers(symbols: string[]): Promise<Ticker[]> {
  if (!symbols.length) return [];
  const { getBySymbols } = await import("./coins.server");
  const listing = await getBySymbols(symbols.map((s) => s.replace(/\.CG$/, "")));
  const out: Ticker[] = [];
  for (const symbol of symbols) {
    const coin = listing?.coins.find((c) => c.symbol === symbol.replace(/\.CG$/, ""));
    if (coin) out.push({ symbol, price: coin.price, change24h: coin.change24h ?? 0 });
  }
  return out;
}

export async function fetchTickers(symbols: string[]): Promise<Ticker[]> {
  const unique = [...new Set(symbols.filter(Boolean))];
  if (!unique.length) return [];
  const gecko = unique.filter((s) => s.endsWith(".CG"));
  if (gecko.length) {
    const rest = unique.filter((s) => !s.endsWith(".CG"));
    const [a, b] = await Promise.all([fetchTickers(rest), fetchGeckoTickers(gecko)]);
    return [...a, ...b];
  }
  const found = new Map<string, LiveTicker>();
  const need: string[] = [];
  const now = Date.now();
  for (const symbol of unique) {
    const hit = memo.get(`t:${symbol}`);
    if (hit && !hit.inflight && now - hit.at < TICKER_TTL && hit.value) {
      found.set(symbol, hit.value as LiveTicker);
    } else need.push(symbol);
  }
  if (need.length) {
    const yahooSymbols: string[] = [];
    const binanceSymbols: string[] = [];
    for (const symbol of need) {
      if (stockAssetOf(symbol)) yahooSymbols.push(symbol);
      else binanceSymbols.push(symbol);
    }
    await Promise.all([
      binanceSymbols.length ? fillBinanceTickers(binanceSymbols, found) : Promise.resolve(),
      ...yahooSymbols.map(async (symbol) => {
        const ticker = await once(`t:${symbol}`, TICKER_TTL, () => loadYahooTicker(symbol));
        if (ticker) found.set(symbol, ticker);
      }),
    ]);
  }
  return unique
    .map((symbol) => found.get(symbol))
    .filter((row): row is LiveTicker => Boolean(row))
    .map(({ symbol, price, change24h }) => ({ symbol, price, change24h }));
}

/** Full 24h stats (price, high/low, volume) for one coin's detail view. */
export async function fetchTickerDetail(symbol: string): Promise<LiveTicker | null> {
  const hit = memo.get(`t:${symbol}`);
  if (hit && !hit.inflight && Date.now() - hit.at < TICKER_TTL && hit.value) {
    return hit.value as LiveTicker;
  }
  if (stockAssetOf(symbol)) return loadYahooTicker(symbol);
  // One symbol, so a retry is cheap — worth it since this fires alongside the
  // full-tape scan and can lose the race for a Binance connection slot.
  for (let attempt = 0; attempt < 2; attempt++) {
    const found = new Map<string, LiveTicker>();
    await fillBinanceTickers([symbol], found);
    const ticker = found.get(symbol);
    if (ticker) return ticker;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return null;
}

/** Share of recent volume that was taker buys — an approximation of buyer vs seller pressure. Crypto-only; Yahoo has no equivalent. */
export async function fetchBuyPressure(symbol: string, interval: string): Promise<number | null> {
  if (stockAssetOf(symbol)) return null;
  return once(`bp:${symbol}:${interval}`, KLINE_TTL, async () => {
    const data = await binanceJson<RawKline[]>(
      `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=20`,
    );
    if (!Array.isArray(data) || !data.length) return null;
    let vol = 0;
    let buyVol = 0;
    for (const row of data) {
      vol += Number(row[5]);
      buyVol += Number(row[9]);
    }
    if (vol <= 0) return null;
    return buyVol / vol;
  });
}

export async function fetchFearGreed(): Promise<FearGreed | undefined> {
  return once("fng", FNG_TTL, async () => {
    const json = await getJson<{ data?: { value?: string; value_classification?: string }[] }>(
      "https://api.alternative.me/fng/?limit=1",
    );
    const row = json?.data?.[0];
    if (!row) return undefined;
    const value = Number(row.value);
    if (!Number.isFinite(value)) return undefined;
    return { value, label: row.value_classification ?? "—" };
  });
}

export { assetOf };
