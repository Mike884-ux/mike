/**
 * The exchanges the site sends people to — shared by server and client.
 *
 * Fees, features and country availability below are as of September 2026 and
 * change over time: edit them here, in one place. Referral codes come from
 * env (BINANCE_REF, BYBIT_REF, OKX_REF, BITGET_REF, KUCOIN_REF, MEXC_REF);
 * each may be a bare code or a full partner link.
 *
 * Recommendations follow what serves the visitor — their country and whether
 * the coin trades there — and only then, as a tie-break, a partner link.
 */
import type { CountryId } from "./lang";

export const EXCHANGES = ["binance", "bybit", "okx", "bitget", "kucoin", "mexc"] as const;
export type Exchange = (typeof EXCHANGES)[number];
export type ExchangeRefs = Record<Exchange, string | null>;

export function asExchange(value: unknown): Exchange | null {
  return EXCHANGES.includes(value as Exchange) ? (value as Exchange) : null;
}

export type Deposit = "p2p" | "card" | "crypto" | "bank";

export type ExchangeInfo = {
  name: string;
  /** Letters on the logo chip. */
  short: string;
  /** Brand colours for the logo chip: background and text. */
  bg: string;
  fg: string;
  /** Standard spot fees, % per trade. */
  maker: number;
  taker: number;
  deposits: Deposit[];
  /** Liquidity, track record and reliability, 0–100 — the main tie-break between available exchanges. */
  quality: number;
  founded: number;
};

export const EXCHANGE_INFO: Record<Exchange, ExchangeInfo> = {
  binance: { name: "Binance", short: "BN", bg: "#F0B90B", fg: "#1E2026", maker: 0.1, taker: 0.1, deposits: ["p2p", "card", "crypto", "bank"], quality: 100, founded: 2017 },
  okx: { name: "OKX", short: "OKX", bg: "#000000", fg: "#FFFFFF", maker: 0.08, taker: 0.1, deposits: ["p2p", "card", "crypto"], quality: 92, founded: 2017 },
  bybit: { name: "Bybit", short: "BY", bg: "#17181E", fg: "#F7A600", maker: 0.1, taker: 0.1, deposits: ["p2p", "card", "crypto"], quality: 90, founded: 2018 },
  bitget: { name: "Bitget", short: "BG", bg: "#00F0FF", fg: "#062026", maker: 0.1, taker: 0.1, deposits: ["p2p", "card", "crypto"], quality: 84, founded: 2018 },
  kucoin: { name: "KuCoin", short: "KC", bg: "#23AF91", fg: "#FFFFFF", maker: 0.1, taker: 0.1, deposits: ["p2p", "card", "crypto"], quality: 80, founded: 2017 },
  mexc: { name: "MEXC", short: "MX", bg: "#1972F5", fg: "#FFFFFF", maker: 0, taker: 0.05, deposits: ["p2p", "card", "crypto"], quality: 72, founded: 2018 },
};

/** Kept for places that only need the name. */
export const EXCHANGE_LABEL: Record<Exchange, string> = Object.fromEntries(EXCHANGES.map((e) => [e, EXCHANGE_INFO[e].name])) as Record<Exchange, string>;

export type Availability = "ok" | "limited" | "blocked";

/** Exceptions to "available"; every country not listed is "ok". */
const AVAILABILITY: Record<Exchange, Partial<Record<CountryId, Availability>>> = {
  binance: { US: "blocked", GB: "blocked", RU: "blocked", BY: "limited", UZ: "limited" },
  bybit: { US: "blocked", GB: "limited", UZ: "limited" },
  okx: { US: "blocked", RU: "limited", UZ: "limited" },
  bitget: { US: "blocked", GB: "blocked", UZ: "limited" },
  kucoin: { US: "blocked", GB: "limited", UZ: "limited" },
  mexc: { US: "blocked", GB: "blocked", UZ: "limited" },
};

export function availability(exchange: Exchange, country: CountryId): Availability {
  return AVAILABILITY[exchange][country] ?? "ok";
}

/** Quote currencies worth showing, most useful first. */
export const QUOTES = ["USDT", "USDC", "FDUSD", "EUR", "TRY", "BTC"] as const;
export type Quote = (typeof QUOTES)[number];

/** Per exchange: the quotes the coin trades against, or null when the list couldn't be checked. */
export type ExchangePairs = Record<Exchange, Quote[] | null>;

/** Stablecoins have no "<coin>/USDT" market worth trading. */
const STABLES = new Set([
  "USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "PYUSD", "USDS", "USDD", "BUSD", "USD1", "RLUSD", "GUSD", "FRAX", "USDP", "EURC", "USDX", "SUSDE", "USD0",
]);

export function isTradable(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  return /^[A-Z0-9]{2,12}$/.test(s) && !STABLES.has(s);
}

/**
 * The exchange's spot page for the pair. A referral value that is a full link
 * is used as-is (the partner's own landing page); a bare code is added in the
 * way each exchange expects.
 */
export function tradeUrl(exchange: Exchange, symbol: string, ref: string | null | undefined, quote: Quote = "USDT"): string {
  if (ref && /^https:\/\//i.test(ref)) return ref;
  const base = encodeURIComponent(symbol.trim().toUpperCase());
  const q = encodeURIComponent(quote);
  const code = ref ? encodeURIComponent(ref) : null;
  switch (exchange) {
    case "binance":
      return `https://www.binance.com/en/trade/${base}_${q}?type=spot${code ? `&ref=${code}` : ""}`;
    case "bybit":
      return `https://www.bybit.com/en/trade/spot/${base}/${q}${code ? `?ref=${code}` : ""}`;
    case "okx":
      return code ? `https://www.okx.com/join/${code}` : `https://www.okx.com/trade-spot/${base.toLowerCase()}-${q.toLowerCase()}`;
    case "bitget":
      return code ? `https://www.bitget.com/referral/register?clacCode=${code}` : `https://www.bitget.com/spot/${base}${q}`;
    case "kucoin":
      return `https://www.kucoin.com/trade/${base}-${q}${code ? `?rcode=${code}` : ""}`;
    case "mexc":
      return `https://www.mexc.com/exchange/${base}_${q}${code ? `?inviteCode=${code}` : ""}`;
  }
}

export type RankedExchange = {
  id: Exchange;
  availability: Availability;
  /** Quotes the coin trades against there; null = not checked. */
  quotes: Quote[] | null;
  /** The pair to open: USDT when there, else the first known. */
  quote: Quote;
  favorite: boolean;
  partner: boolean;
};

export type Ranking = { recommended: RankedExchange | null; alternative: RankedExchange | null; rest: RankedExchange[] };

/**
 * Orders the exchanges for one visitor and one coin. Blocked in their country
 * is never recommended; then: the coin trades there, their own exchange, fully
 * available over "limited", overall quality — and a partner link only breaks
 * an exact tie.
 */
export function rankExchanges(input: {
  country: CountryId;
  pairs?: Partial<ExchangePairs> | null;
  favorite?: Exchange | null;
  refs?: Partial<ExchangeRefs> | null;
}): Ranking {
  const rows: RankedExchange[] = EXCHANGES.map((id) => {
    const quotes = input.pairs?.[id] ?? null;
    return {
      id,
      availability: availability(id, input.country),
      quotes,
      quote: quotes?.includes("USDT") || !quotes?.length ? "USDT" : quotes[0]!,
      favorite: input.favorite === id,
      partner: Boolean(input.refs?.[id]),
    };
  });
  // Listed = 2, not checked = 1, known missing = 0.
  const listed = (r: RankedExchange) => (r.quotes === null ? 1 : r.quotes.length ? 2 : 0);
  const keys = (r: RankedExchange) => [
    r.availability === "blocked" ? 0 : 1,
    listed(r),
    r.favorite ? 1 : 0,
    r.availability === "ok" ? 1 : 0,
    EXCHANGE_INFO[r.id].quality,
    r.partner ? 1 : 0,
  ];
  rows.sort((a, b) => {
    const x = keys(a);
    const y = keys(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i]! - x[i]!;
    return 0;
  });
  const usable = (r: RankedExchange | undefined) => (r && r.availability !== "blocked" && listed(r) > 0 ? r : null);
  const recommended = usable(rows[0]);
  const alternative = recommended ? usable(rows[1]) : null;
  const shown = [recommended, alternative].filter(Boolean) as RankedExchange[];
  return { recommended, alternative, rest: rows.filter((r) => !shown.includes(r)) };
}
