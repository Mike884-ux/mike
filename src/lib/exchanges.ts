/**
 * "Trade on Binance / Bybit" links for a coin, carrying the owner's referral
 * code when one is set (BINANCE_REF, BYBIT_REF). Shared by server and client.
 */
export const EXCHANGES = ["binance", "bybit"] as const;
export type Exchange = (typeof EXCHANGES)[number];
export type ExchangeRefs = Record<Exchange, string | null>;

export const EXCHANGE_LABEL: Record<Exchange, string> = { binance: "Binance", bybit: "Bybit" };

/** Stablecoins have no "<coin>/USDT" market worth trading. */
const STABLES = new Set([
  "USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "PYUSD", "USDS", "USDD", "BUSD", "USD1", "RLUSD", "GUSD", "FRAX", "USDP", "EURC", "USDX", "SUSDE", "USD0",
]);

export function isTradable(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  return /^[A-Z0-9]{2,12}$/.test(s) && !STABLES.has(s);
}

export function tradeUrl(exchange: Exchange, symbol: string, ref: string | null | undefined): string {
  const base = encodeURIComponent(symbol.trim().toUpperCase());
  const code = ref ? encodeURIComponent(ref) : null;
  if (exchange === "binance") return `https://www.binance.com/en/trade/${base}_USDT?type=spot${code ? `&ref=${code}` : ""}`;
  return `https://www.bybit.com/en/trade/spot/${base}/USDT${code ? `?ref=${code}` : ""}`;
}
