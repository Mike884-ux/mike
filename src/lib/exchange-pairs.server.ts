/**
 * Which spot pairs each exchange lists — **server-only**. Public market lists,
 * no keys; each is fetched at most once per 6 hours and shared. An exchange
 * that doesn't answer (some block the server's country) reads as "not checked"
 * instead of "not listed", so it is never pushed down by our own outage.
 */
import { EXCHANGES, QUOTES, type Exchange, type ExchangePairs, type Quote } from "./exchanges.ts";

const TTL = 6 * 60 * 60_000;
const RETRY_AFTER_FAILURE = 10 * 60_000;
const TIMEOUT = 8_000;

type PairSet = Set<string>; // "BTC/USDT"

const cache = new Map<Exchange, { at: number; pairs: PairSet | null; failed: boolean }>();
const inflight = new Map<Exchange, Promise<PairSet | null>>();

const QUOTE_SET = new Set<string>(QUOTES);
const BY_LENGTH = [...QUOTES].sort((a, b) => b.length - a.length);

/** "BTCUSDT" → "BTC/USDT" for the quotes we show; anything else is skipped. */
function splitJoined(symbol: string): string | null {
  const s = symbol.toUpperCase();
  for (const q of BY_LENGTH) if (s.endsWith(q) && s.length > q.length) return `${s.slice(0, -q.length)}/${q}`;
  return null;
}

function pair(base: unknown, quote: unknown): string | null {
  const q = String(quote ?? "").toUpperCase();
  return base && QUOTE_SET.has(q) ? `${String(base).toUpperCase()}/${q}` : null;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

type Row = Record<string, unknown>;
const list = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

const SOURCES: Record<Exchange, () => Promise<(string | null)[]>> = {
  binance: async () => {
    for (const host of ["https://data-api.binance.vision", "https://api.binance.com"]) {
      try {
        return list(await getJson(`${host}/api/v3/ticker/price`)).map((r) => splitJoined(String(r.symbol ?? "")));
      } catch {
        // try the next host
      }
    }
    throw new Error("binance unavailable");
  },
  bybit: async () => {
    const data = (await getJson("https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000")) as { result?: { list?: unknown } };
    return list(data.result?.list).filter((r) => r.status === "Trading").map((r) => pair(r.baseCoin, r.quoteCoin));
  },
  okx: async () => {
    const data = (await getJson("https://www.okx.com/api/v5/public/instruments?instType=SPOT")) as { data?: unknown };
    return list(data.data).filter((r) => r.state === "live").map((r) => pair(r.baseCcy, r.quoteCcy));
  },
  bitget: async () => {
    const data = (await getJson("https://api.bitget.com/api/v2/spot/public/symbols")) as { data?: unknown };
    return list(data.data).filter((r) => r.status === "online").map((r) => pair(r.baseCoin, r.quoteCoin));
  },
  kucoin: async () => {
    const data = (await getJson("https://api.kucoin.com/api/v2/symbols")) as { data?: unknown };
    return list(data.data).filter((r) => r.enableTrading !== false).map((r) => pair(r.baseCurrency, r.quoteCurrency));
  },
  mexc: async () => {
    const data = (await getJson("https://api.mexc.com/api/v3/defaultSymbols")) as { data?: unknown };
    return list(data.data).map((s) => splitJoined(String(s)));
  },
};

async function pairsOf(exchange: Exchange, now: number): Promise<PairSet | null> {
  const hit = cache.get(exchange);
  if (hit && now - hit.at < (hit.failed ? RETRY_AFTER_FAILURE : TTL)) return hit.pairs;
  let running = inflight.get(exchange);
  if (!running) {
    running = SOURCES[exchange]()
      .then((rows) => {
        const set = new Set(rows.filter((r): r is string => Boolean(r)));
        return set.size ? set : null;
      })
      .catch((err) => {
        console.warn(`[exchanges] ${exchange} pairs unavailable:`, err instanceof Error ? err.message : err);
        return null;
      })
      .then((pairs) => {
        // A failed list keeps the last good one, if any, and is retried sooner.
        const kept = pairs ?? cache.get(exchange)?.pairs ?? null;
        cache.set(exchange, { at: now, pairs: kept, failed: !pairs });
        return kept;
      })
      .finally(() => inflight.delete(exchange));
    inflight.set(exchange, running);
  }
  return running;
}

/** For each exchange, the quotes the coin trades against — or null when the list couldn't be checked. */
export async function exchangePairs(base: string, now = Date.now()): Promise<ExchangePairs> {
  const b = base.trim().toUpperCase();
  const sets = await Promise.all(EXCHANGES.map((e) => pairsOf(e, now)));
  return Object.fromEntries(
    EXCHANGES.map((e, i) => {
      const set = sets[i];
      return [e, set ? QUOTES.filter((q: Quote) => q !== b && set.has(`${b}/${q}`)) : null];
    }),
  ) as ExchangePairs;
}

/** Coins Binance trades against USDT right now, or null when its list couldn't be read. */
export async function binanceUsdtBases(now = Date.now()): Promise<Set<string> | null> {
  const set = await pairsOf("binance", now);
  if (!set) return null;
  const bases = new Set<string>();
  for (const p of set) if (p.endsWith("/USDT")) bases.add(p.slice(0, -5));
  return bases;
}

/** Tests start from an empty cache. */
export function resetExchangePairs(): void {
  cache.clear();
  inflight.clear();
}
