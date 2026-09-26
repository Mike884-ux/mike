/**
 * Pure converters from upstream JSON (CoinGecko, CoinPaprika, Binance) to the
 * site's own shapes. No I/O here, so they are unit-tested directly; every
 * field is read defensively because free APIs change and omit things.
 */
import type { CoinInfo, CoinLinks, GlobalStats, HistoryPoint, MarketCoin, SearchHit, TrendingCoin } from "./coins.ts";

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Keeps ~6 significant digits: the sparkline and chart don't need more, and it halves the payload. */
export function roundSig(value: number, digits = 6): number {
  if (!Number.isFinite(value) || value === 0) return value;
  return Number(value.toPrecision(digits));
}

/** Evenly spaced subset of `values`, always keeping the first and the last point. */
export function thin<T>(values: T[], target: number): T[] {
  if (values.length <= target || target < 2) return values.slice();
  const out: T[] = [];
  const step = (values.length - 1) / (target - 1);
  for (let i = 0; i < target; i++) out.push(values[Math.round(i * step)]!);
  return out;
}

export const SPARK_POINTS = 42;

/** Only http(s) links are ever rendered as <a href>. */
export function safeUrl(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** CoinGecko serves 250px logos in listings; the table only needs the small variant. */
export function smallImage(value: unknown): string | null {
  const url = safeUrl(value);
  return url ? url.replace(/\/large\//, "/small/") : null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
};

/** CoinGecko descriptions are HTML with links; the page shows them as plain text. */
export function plainText(html: string, maxLength = 3000): string {
  const text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
      const lower = code.toLowerCase();
      if (lower in ENTITIES) return ENTITIES[lower]!;
      if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16) || 32);
      if (lower.startsWith("#")) return String.fromCodePoint(Number(lower.slice(1)) || 32);
      return match;
    })
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
  return `${lastStop > maxLength * 0.6 ? cut.slice(0, lastStop + 1) : cut.trimEnd()}…`;
}

/** One row of CoinGecko /coins/markets. */
export function mapCgMarket(raw: unknown): MarketCoin | null {
  const row = obj(raw);
  const id = str(row.id);
  const price = num(row.current_price);
  if (!id || price === null) return null;
  const spark = arr(obj(row.sparkline_in_7d).price)
    .map(num)
    .filter((v): v is number => v !== null && v > 0);
  return {
    id,
    rank: num(row.market_cap_rank),
    symbol: (str(row.symbol) ?? id).toUpperCase(),
    name: str(row.name) ?? id,
    image: smallImage(row.image),
    price,
    change1h: num(row.price_change_percentage_1h_in_currency),
    change24h: num(row.price_change_percentage_24h_in_currency) ?? num(row.price_change_percentage_24h),
    change7d: num(row.price_change_percentage_7d_in_currency),
    marketCap: num(row.market_cap) || null,
    volume24h: num(row.total_volume),
    circulating: num(row.circulating_supply) || null,
    totalSupply: num(row.total_supply) || null,
    maxSupply: num(row.max_supply) || null,
    fdv: num(row.fully_diluted_valuation) || null,
    spark: thin(spark, SPARK_POINTS).map((v) => roundSig(v)),
  };
}

/**
 * CoinPaprika ids are "<symbol>-<name>" ("btc-bitcoin"). Dropping the symbol
 * part gives the CoinGecko id for most large coins, which keeps coin page
 * links working when the listing came from the fallback source.
 */
export function cgIdFromPaprika(id: string): string {
  const dash = id.indexOf("-");
  return dash > 0 && dash < id.length - 1 ? id.slice(dash + 1) : id;
}

/** One row of CoinPaprika /v1/tickers. */
export function mapPaprikaTicker(raw: unknown): MarketCoin | null {
  const row = obj(raw);
  const paprikaId = str(row.id);
  const usd = obj(obj(row.quotes).USD);
  const price = num(usd.price);
  if (!paprikaId || price === null) return null;
  const circulating = num(row.circulating_supply) || null;
  const maxSupply = num(row.max_supply) || null;
  const totalSupply = num(row.total_supply) || null;
  return {
    id: cgIdFromPaprika(paprikaId),
    rank: num(row.rank) || null,
    symbol: (str(row.symbol) ?? paprikaId).toUpperCase(),
    name: str(row.name) ?? paprikaId,
    image: `https://static.coinpaprika.com/coin/${encodeURIComponent(paprikaId)}/logo.png`,
    price,
    change1h: num(usd.percent_change_1h),
    change24h: num(usd.percent_change_24h),
    change7d: num(usd.percent_change_7d),
    marketCap: num(usd.market_cap) || null,
    volume24h: num(usd.volume_24h),
    circulating,
    totalSupply,
    maxSupply,
    fdv: maxSupply ? maxSupply * price : totalSupply ? totalSupply * price : null,
    spark: [],
  };
}

export function mapCgGlobal(raw: unknown): Omit<GlobalStats, "fearGreed" | "updatedAt"> | null {
  const data = obj(obj(raw).data);
  const cap = num(obj(data.total_market_cap).usd);
  if (cap === null) return null;
  const share = obj(data.market_cap_percentage);
  return {
    coins: num(data.active_cryptocurrencies),
    markets: num(data.markets),
    marketCap: cap,
    marketCapChange24h: num(data.market_cap_change_percentage_24h_usd),
    volume24h: num(obj(data.total_volume).usd),
    btcDominance: num(share.btc),
    ethDominance: num(share.eth),
    source: "coingecko",
  };
}

export function mapPaprikaGlobal(raw: unknown): Omit<GlobalStats, "fearGreed" | "updatedAt"> | null {
  const data = obj(raw);
  const cap = num(data.market_cap_usd);
  if (cap === null) return null;
  return {
    coins: num(data.cryptocurrencies_number),
    markets: null,
    marketCap: cap,
    marketCapChange24h: num(data.market_cap_change_24h),
    volume24h: num(data.volume_24h_usd),
    btcDominance: num(data.bitcoin_dominance_percentage),
    ethDominance: null,
    source: "coinpaprika",
  };
}

export function mapCgTrending(raw: unknown): TrendingCoin[] {
  const out: TrendingCoin[] = [];
  for (const entry of arr(obj(raw).coins)) {
    const item = obj(obj(entry).item);
    const id = str(item.id);
    if (!id) continue;
    const data = obj(item.data);
    out.push({
      id,
      name: str(item.name) ?? id,
      symbol: (str(item.symbol) ?? id).toUpperCase(),
      image: safeUrl(item.small) ?? safeUrl(item.thumb),
      rank: num(item.market_cap_rank),
      price: num(data.price),
      change24h: num(obj(data.price_change_percentage_24h).usd),
    });
  }
  return out;
}

export function mapCgSearch(raw: unknown): SearchHit[] {
  const out: SearchHit[] = [];
  for (const entry of arr(obj(raw).coins)) {
    const row = obj(entry);
    const id = str(row.id);
    if (!id) continue;
    out.push({
      id,
      name: str(row.name) ?? id,
      symbol: (str(row.symbol) ?? id).toUpperCase(),
      rank: num(row.market_cap_rank),
      image: safeUrl(row.thumb) ?? safeUrl(row.large),
    });
  }
  return out;
}

function firstUrl(value: unknown): string | null {
  for (const item of arr(value)) {
    const url = safeUrl(item);
    if (url) return url;
  }
  return null;
}

function mapLinks(raw: unknown): CoinLinks {
  const links = obj(raw);
  const twitter = str(links.twitter_screen_name);
  const telegram = str(links.telegram_channel_identifier);
  return {
    homepage: firstUrl(links.homepage),
    whitepaper: safeUrl(links.whitepaper),
    explorers: arr(links.blockchain_site)
      .map(safeUrl)
      .filter((u): u is string => Boolean(u))
      .slice(0, 3),
    github: firstUrl(obj(links.repos_url).github),
    twitter: twitter && /^[A-Za-z0-9_]{1,30}$/.test(twitter) ? `https://x.com/${twitter}` : null,
    reddit: safeUrl(links.subreddit_url),
    telegram: telegram && /^[A-Za-z0-9_]{3,64}$/.test(telegram) ? `https://t.me/${telegram}` : null,
  };
}

/** Description language: CoinGecko has Russian for many coins; English otherwise. */
function pickDescription(description: Obj, lang: string): string {
  const order = lang === "ru" ? ["ru", "en"] : ["en"];
  for (const key of order) {
    const text = str(description[key]);
    if (text) return plainText(text);
  }
  return "";
}

/** CoinGecko /coins/{id}. */
export function mapCgCoin(raw: unknown, lang: string, now = Date.now()): CoinInfo | null {
  const row = obj(raw);
  const id = str(row.id);
  const market = obj(row.market_data);
  const usd = (key: string) => num(obj(market[key]).usd);
  const price = usd("current_price");
  if (!id || price === null) return null;
  const image = obj(row.image);
  return {
    id,
    rank: num(row.market_cap_rank) ?? num(market.market_cap_rank),
    symbol: (str(row.symbol) ?? id).toUpperCase(),
    name: str(row.name) ?? id,
    image: safeUrl(image.large) ?? safeUrl(image.small),
    price,
    change1h: usd("price_change_percentage_1h_in_currency"),
    change24h: usd("price_change_percentage_24h_in_currency") ?? num(market.price_change_percentage_24h),
    change7d: usd("price_change_percentage_7d_in_currency") ?? num(market.price_change_percentage_7d),
    change30d: usd("price_change_percentage_30d_in_currency") ?? num(market.price_change_percentage_30d),
    change1y: usd("price_change_percentage_1y_in_currency") ?? num(market.price_change_percentage_1y),
    marketCap: usd("market_cap") || null,
    volume24h: usd("total_volume"),
    circulating: num(market.circulating_supply) || null,
    totalSupply: num(market.total_supply) || null,
    maxSupply: num(market.max_supply) || null,
    fdv: usd("fully_diluted_valuation") || null,
    high24h: usd("high_24h"),
    low24h: usd("low_24h"),
    ath: usd("ath"),
    athDate: str(obj(market.ath_date).usd),
    athChange: usd("ath_change_percentage"),
    atl: usd("atl"),
    atlDate: str(obj(market.atl_date).usd),
    atlChange: usd("atl_change_percentage"),
    spark: [],
    description: pickDescription(obj(row.description), lang),
    categories: arr(row.categories)
      .map(str)
      .filter((c): c is string => Boolean(c))
      .slice(0, 8),
    links: mapLinks(row.links),
    genesisDate: str(row.genesis_date),
    source: "coingecko",
    updatedAt: now,
  };
}

/** Listing row → coin page data when the full CoinGecko record is unavailable. */
export function infoFromMarket(coin: MarketCoin, source: CoinInfo["source"], now = Date.now()): CoinInfo {
  return {
    ...coin,
    high24h: null,
    low24h: null,
    change30d: null,
    change1y: null,
    ath: null,
    athDate: null,
    athChange: null,
    atl: null,
    atlDate: null,
    atlChange: null,
    description: "",
    categories: [],
    links: { homepage: null, whitepaper: null, explorers: [], github: null, twitter: null, reddit: null, telegram: null },
    genesisDate: null,
    source,
    updatedAt: now,
  };
}

export const HISTORY_POINTS = 400;

/** CoinGecko /coins/{id}/market_chart → one point per step with its volume. */
export function historyFromCgChart(raw: unknown): HistoryPoint[] {
  const data = obj(raw);
  const volumes = new Map<number, number>();
  for (const pair of arr(data.total_volumes)) {
    const [t, v] = arr(pair).map(num);
    if (t != null && v != null) volumes.set(t, v);
  }
  const points: HistoryPoint[] = [];
  for (const pair of arr(data.prices)) {
    const [t, p] = arr(pair).map(num);
    if (t == null || p == null || p <= 0) continue;
    const price = roundSig(p, 8);
    points.push({ t, o: price, h: price, l: price, c: price, v: Math.round(volumes.get(t) ?? 0) });
  }
  points.sort((a, b) => a.t - b.t);
  return thin(points, HISTORY_POINTS);
}

/** Binance klines → candles with quote (USD) volume. */
export function historyFromKlines(rows: unknown): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  for (const entry of arr(rows)) {
    const row = arr(entry);
    const t = num(row[0]);
    const o = num(row[1]);
    const h = num(row[2]);
    const l = num(row[3]);
    const c = num(row[4]);
    const quoteVolume = num(row[7]);
    if (t == null || o == null || h == null || l == null || c == null || c <= 0) continue;
    points.push({ t, o, h, l, c, v: Math.round(quoteVolume ?? 0) });
  }
  return points.sort((a, b) => a.t - b.t);
}

/**
 * Approximate top-N market cap over the last 7 days: every coin's sparkline
 * times its current circulating supply, summed point by point. Supplies barely
 * move in a week, so the shape is faithful; it is labelled as top-N, not total.
 */
export function capSeries(coins: MarketCoin[]): number[] {
  const usable = coins.filter((c) => c.spark.length === SPARK_POINTS && (c.circulating ?? 0) > 0);
  if (usable.length < 5) return [];
  const sums = new Array<number>(SPARK_POINTS).fill(0);
  for (const coin of usable) {
    for (let i = 0; i < SPARK_POINTS; i++) sums[i]! += coin.spark[i]! * coin.circulating!;
  }
  return sums.map((v) => roundSig(v, 5));
}
