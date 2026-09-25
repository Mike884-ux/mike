export type AssetKind = "crypto" | "metal" | "stock";

export type Asset = {
  base: string;
  kind: AssetKind;
  binance?: string;
  yahoo?: string;
  aliases: string[];
};

const ASSETS: Asset[] = [
  { base: "BTC", kind: "crypto", binance: "BTCUSDT", aliases: ["bitcoin", "биткоин", "биток"] },
  { base: "ETH", kind: "crypto", binance: "ETHUSDT", aliases: ["ethereum", "эфир", "эфириум"] },
  { base: "SOL", kind: "crypto", binance: "SOLUSDT", aliases: ["solana", "солана"] },
  { base: "BNB", kind: "crypto", binance: "BNBUSDT", aliases: ["binance"] },
  { base: "XRP", kind: "crypto", binance: "XRPUSDT", aliases: ["ripple"] },
  { base: "DOGE", kind: "crypto", binance: "DOGEUSDT", aliases: ["dogecoin", "доги", "додж"] },
  { base: "ADA", kind: "crypto", binance: "ADAUSDT", aliases: ["cardano"] },
  { base: "AVAX", kind: "crypto", binance: "AVAXUSDT", aliases: ["avalanche"] },
  { base: "LINK", kind: "crypto", binance: "LINKUSDT", aliases: ["chainlink"] },
  { base: "TON", kind: "crypto", binance: "TONUSDT", aliases: ["toncoin"] },
  { base: "SUI", kind: "crypto", binance: "SUIUSDT", aliases: [] },
  { base: "NEAR", kind: "crypto", binance: "NEARUSDT", aliases: [] },
  { base: "APT", kind: "crypto", binance: "APTUSDT", aliases: ["aptos"] },
  { base: "ATOM", kind: "crypto", binance: "ATOMUSDT", aliases: ["cosmos"] },
  { base: "LTC", kind: "crypto", binance: "LTCUSDT", aliases: ["litecoin"] },
  { base: "BCH", kind: "crypto", binance: "BCHUSDT", aliases: ["bitcoin cash"] },
  { base: "DOT", kind: "crypto", binance: "DOTUSDT", aliases: ["polkadot"] },
  { base: "UNI", kind: "crypto", binance: "UNIUSDT", aliases: ["uniswap"] },
  { base: "AAVE", kind: "crypto", binance: "AAVEUSDT", aliases: [] },
  { base: "ARB", kind: "crypto", binance: "ARBUSDT", aliases: ["arbitrum"] },
  { base: "OP", kind: "crypto", binance: "OPUSDT", aliases: ["optimism"] },
  { base: "HBAR", kind: "crypto", binance: "HBARUSDT", aliases: ["hedera"] },
  { base: "XLM", kind: "crypto", binance: "XLMUSDT", aliases: ["stellar"] },
  { base: "ICP", kind: "crypto", binance: "ICPUSDT", aliases: ["internet computer"] },
  { base: "ETC", kind: "crypto", binance: "ETCUSDT", aliases: ["ethereum classic"] },
  { base: "POL", kind: "crypto", binance: "POLUSDT", aliases: ["matic", "polygon"] },
  { base: "FIL", kind: "crypto", binance: "FILUSDT", aliases: ["filecoin"] },
  { base: "TAO", kind: "crypto", binance: "TAOUSDT", aliases: ["bittensor"] },
  { base: "INJ", kind: "crypto", binance: "INJUSDT", aliases: ["injective"] },
  { base: "SEI", kind: "crypto", binance: "SEIUSDT", aliases: [] },
  { base: "TIA", kind: "crypto", binance: "TIAUSDT", aliases: ["celestia"] },
  { base: "RENDER", kind: "crypto", binance: "RENDERUSDT", aliases: ["rndr"] },
  { base: "FET", kind: "crypto", binance: "FETUSDT", aliases: ["fetch"] },
  { base: "ONDO", kind: "crypto", binance: "ONDOUSDT", aliases: [] },
  { base: "JUP", kind: "crypto", binance: "JUPUSDT", aliases: ["jupiter"] },
  { base: "PEPE", kind: "crypto", binance: "PEPEUSDT", aliases: [] },
  { base: "WIF", kind: "crypto", binance: "WIFUSDT", aliases: ["dogwifhat"] },
  { base: "SHIB", kind: "crypto", binance: "SHIBUSDT", aliases: ["shiba"] },
  { base: "BONK", kind: "crypto", binance: "BONKUSDT", aliases: [] },
  { base: "FLOKI", kind: "crypto", binance: "FLOKIUSDT", aliases: [] },
  { base: "MEME", kind: "crypto", binance: "MEMEUSDT", aliases: [] },
  { base: "NEIRO", kind: "crypto", binance: "NEIROUSDT", aliases: [] },
  { base: "TRX", kind: "crypto", binance: "TRXUSDT", aliases: ["tron"] },
  { base: "GOLD", kind: "metal", binance: "PAXGUSDT", yahoo: "GC=F", aliases: ["xau", "золото", "gold", "xauusd", "paxg"] },
  { base: "SILVER", kind: "metal", yahoo: "SI=F", aliases: ["xag", "серебро", "silver"] },
  { base: "AAPL", kind: "stock", yahoo: "AAPL", aliases: ["apple"] },
  { base: "NVDA", kind: "stock", yahoo: "NVDA", aliases: ["nvidia"] },
  { base: "TSLA", kind: "stock", yahoo: "TSLA", aliases: ["tesla"] },
  { base: "MSFT", kind: "stock", yahoo: "MSFT", aliases: ["microsoft"] },
  { base: "AMZN", kind: "stock", yahoo: "AMZN", aliases: ["amazon"] },
  { base: "GOOG", kind: "stock", yahoo: "GOOG", aliases: ["google", "alphabet"] },
  { base: "META", kind: "stock", yahoo: "META", aliases: ["facebook"] },
  { base: "SBER", kind: "stock", yahoo: "SBER.ME", aliases: ["сбер", "sberbank"] },

  // Second wave: 30 more major coins + 20 more major stocks.
  { base: "STX", kind: "crypto", binance: "STXUSDT", aliases: ["stacks"] },
  { base: "RUNE", kind: "crypto", binance: "RUNEUSDT", aliases: ["thorchain"] },
  { base: "ALGO", kind: "crypto", binance: "ALGOUSDT", aliases: ["algorand"] },
  { base: "VET", kind: "crypto", binance: "VETUSDT", aliases: ["vechain"] },
  { base: "THETA", kind: "crypto", binance: "THETAUSDT", aliases: [] },
  { base: "EGLD", kind: "crypto", binance: "EGLDUSDT", aliases: ["multiversx", "elrond"] },
  { base: "XTZ", kind: "crypto", binance: "XTZUSDT", aliases: ["tezos"] },
  { base: "EOS", kind: "crypto", binance: "EOSUSDT", aliases: [] },
  { base: "KAVA", kind: "crypto", binance: "KAVAUSDT", aliases: [] },
  { base: "GRT", kind: "crypto", binance: "GRTUSDT", aliases: ["the graph"] },
  { base: "SAND", kind: "crypto", binance: "SANDUSDT", aliases: ["sandbox"] },
  { base: "MANA", kind: "crypto", binance: "MANAUSDT", aliases: ["decentraland"] },
  { base: "AXS", kind: "crypto", binance: "AXSUSDT", aliases: ["axie infinity"] },
  { base: "CRV", kind: "crypto", binance: "CRVUSDT", aliases: ["curve"] },
  { base: "LDO", kind: "crypto", binance: "LDOUSDT", aliases: ["lido"] },
  { base: "MKR", kind: "crypto", binance: "MKRUSDT", aliases: ["maker"] },
  { base: "SNX", kind: "crypto", binance: "SNXUSDT", aliases: ["synthetix"] },
  { base: "COMP", kind: "crypto", binance: "COMPUSDT", aliases: ["compound"] },
  { base: "ENS", kind: "crypto", binance: "ENSUSDT", aliases: [] },
  { base: "IMX", kind: "crypto", binance: "IMXUSDT", aliases: ["immutable"] },
  { base: "GALA", kind: "crypto", binance: "GALAUSDT", aliases: [] },
  { base: "DYDX", kind: "crypto", binance: "DYDXUSDT", aliases: [] },
  { base: "JTO", kind: "crypto", binance: "JTOUSDT", aliases: ["jito"] },
  { base: "STRK", kind: "crypto", binance: "STRKUSDT", aliases: ["starknet"] },
  { base: "ENA", kind: "crypto", binance: "ENAUSDT", aliases: ["ethena"] },
  { base: "ORDI", kind: "crypto", binance: "ORDIUSDT", aliases: [] },
  { base: "PENDLE", kind: "crypto", binance: "PENDLEUSDT", aliases: [] },
  { base: "BLUR", kind: "crypto", binance: "BLURUSDT", aliases: [] },
  { base: "WLD", kind: "crypto", binance: "WLDUSDT", aliases: ["worldcoin"] },
  { base: "PYTH", kind: "crypto", binance: "PYTHUSDT", aliases: ["pyth network"] },

  { base: "NFLX", kind: "stock", yahoo: "NFLX", aliases: ["netflix"] },
  { base: "AMD", kind: "stock", yahoo: "AMD", aliases: [] },
  { base: "INTC", kind: "stock", yahoo: "INTC", aliases: ["intel"] },
  { base: "ORCL", kind: "stock", yahoo: "ORCL", aliases: ["oracle"] },
  { base: "CRM", kind: "stock", yahoo: "CRM", aliases: ["salesforce"] },
  { base: "ADBE", kind: "stock", yahoo: "ADBE", aliases: ["adobe"] },
  { base: "PYPL", kind: "stock", yahoo: "PYPL", aliases: ["paypal"] },
  { base: "DIS", kind: "stock", yahoo: "DIS", aliases: ["disney"] },
  { base: "KO", kind: "stock", yahoo: "KO", aliases: ["coca-cola", "coca cola"] },
  { base: "WMT", kind: "stock", yahoo: "WMT", aliases: ["walmart"] },
  { base: "JPM", kind: "stock", yahoo: "JPM", aliases: ["jpmorgan"] },
  { base: "V", kind: "stock", yahoo: "V", aliases: ["visa"] },
  { base: "MA", kind: "stock", yahoo: "MA", aliases: ["mastercard"] },
  { base: "BAC", kind: "stock", yahoo: "BAC", aliases: ["bank of america"] },
  { base: "BABA", kind: "stock", yahoo: "BABA", aliases: ["alibaba"] },
  { base: "UBER", kind: "stock", yahoo: "UBER", aliases: [] },
  { base: "PLTR", kind: "stock", yahoo: "PLTR", aliases: ["palantir"] },
  { base: "COIN", kind: "stock", yahoo: "COIN", aliases: ["coinbase"] },
  { base: "MSTR", kind: "stock", yahoo: "MSTR", aliases: ["microstrategy"] },
  { base: "IBM", kind: "stock", yahoo: "IBM", aliases: [] },
];

/** Live spot tape: large-cap crypto + popular memes, Binance USDT. */
export const TAPE_CRYPTOS = [
  "BTC",
  "ETH",
  "BNB",
  "SOL",
  "XRP",
  "DOGE",
  "ADA",
  "TRX",
  "TON",
  "LINK",
  "AVAX",
  "SUI",
  "SHIB",
  "BCH",
  "HBAR",
  "LTC",
  "DOT",
  "XLM",
  "UNI",
  "AAVE",
  "NEAR",
  "APT",
  "ATOM",
  "ICP",
  "ETC",
  "POL",
  "FIL",
  "TAO",
  "ARB",
  "OP",
  "INJ",
  "SEI",
  "TIA",
  "RENDER",
  "FET",
  "ONDO",
  "JUP",
  "PEPE",
  "WIF",
  "BONK",
  "FLOKI",
  "MEME",
  "NEIRO",
  "STX",
  "RUNE",
  "ALGO",
  "VET",
  "THETA",
  "EGLD",
  "XTZ",
  "EOS",
  "KAVA",
  "GRT",
  "SAND",
  "MANA",
  "AXS",
  "CRV",
  "LDO",
  "MKR",
  "SNX",
  "COMP",
  "ENS",
  "IMX",
  "GALA",
  "DYDX",
  "JTO",
  "STRK",
  "ENA",
  "ORDI",
  "PENDLE",
  "BLUR",
  "WLD",
  "PYTH",
] as const;

/** Big-name stocks users can scan alongside crypto, quoted via Yahoo Finance. */
export const TAPE_STOCKS = [
  "AAPL",
  "NVDA",
  "TSLA",
  "MSFT",
  "AMZN",
  "GOOG",
  "META",
  "NFLX",
  "AMD",
  "INTC",
  "ORCL",
  "CRM",
  "ADBE",
  "PYPL",
  "DIS",
  "KO",
  "WMT",
  "JPM",
  "V",
  "MA",
  "BAC",
  "BABA",
  "UBER",
  "PLTR",
  "COIN",
  "MSTR",
  "IBM",
] as const;

const byKey = new Map<string, Asset>();
for (const asset of ASSETS) {
  byKey.set(asset.base.toUpperCase(), asset);
  for (const alias of asset.aliases) byKey.set(alias.toUpperCase(), asset);
}

export function assetOf(base: string): Asset | undefined {
  return byKey.get(base.trim().toUpperCase());
}

export function detectBaseInText(text: string): string | undefined {
  const upper = text.toUpperCase();
  const ranked = [...ASSETS].sort((a, b) => b.base.length - a.base.length);
  for (const asset of ranked) {
    const token = new RegExp(`(?:^|[^A-Z0-9])${asset.base}(?:[^A-Z0-9]|$)`);
    if (token.test(upper)) return asset.base;
    for (const alias of asset.aliases) {
      if (alias.length < 3) continue;
      if (upper.includes(alias.toUpperCase())) return asset.base;
    }
  }
  return undefined;
}

export function quoteOf(asset: Asset): string {
  if (asset.kind === "stock" && asset.base === "SBER") return "RUB";
  if (asset.kind === "crypto") return "USDT";
  return "USD";
}

export function symbolOf(asset: Asset): string {
  if (asset.binance) return asset.binance;
  return `${asset.base}${quoteOf(asset)}`;
}
