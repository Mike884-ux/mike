import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capSeries,
  cgIdFromPaprika,
  historyFromCgChart,
  historyFromKlines,
  mapCgCoin,
  mapCgGlobal,
  mapCgMarket,
  mapCgSearch,
  mapCgTrending,
  mapPaprikaGlobal,
  mapPaprikaTicker,
  plainText,
  safeUrl,
  SPARK_POINTS,
  thin,
} from "./coins-map.ts";

const cgBitcoin = {
  id: "bitcoin",
  symbol: "btc",
  name: "Bitcoin",
  image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400",
  current_price: 64012.5,
  market_cap: 1262000000000,
  market_cap_rank: 1,
  fully_diluted_valuation: 1344000000000,
  total_volume: 31000000000,
  price_change_percentage_24h: 1.2,
  circulating_supply: 19715000,
  total_supply: 21000000,
  max_supply: 21000000,
  sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => 60000 + i * 20.123456789) },
  price_change_percentage_1h_in_currency: 0.12,
  price_change_percentage_24h_in_currency: 1.25,
  price_change_percentage_7d_in_currency: -3.4,
};

test("CoinGecko market row maps to a table row", () => {
  const coin = mapCgMarket(cgBitcoin)!;
  assert.equal(coin.id, "bitcoin");
  assert.equal(coin.symbol, "BTC");
  assert.equal(coin.rank, 1);
  assert.equal(coin.change1h, 0.12);
  assert.equal(coin.change24h, 1.25);
  assert.equal(coin.change7d, -3.4);
  assert.equal(coin.maxSupply, 21000000);
  assert.equal(coin.image, "https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png?1696501400");
  assert.equal(coin.spark.length, SPARK_POINTS);
  assert.equal(coin.spark[0], 60000);
  assert.equal(coin.spark.at(-1), Number((60000 + 167 * 20.123456789).toPrecision(6)));
});

test("rows without a price or id are dropped; missing numbers become null", () => {
  assert.equal(mapCgMarket({ id: "x" }), null);
  assert.equal(mapCgMarket({ current_price: 1 }), null);
  const bare = mapCgMarket({ id: "newcoin", current_price: 0.5, market_cap: 0, max_supply: null })!;
  assert.equal(bare.marketCap, null);
  assert.equal(bare.maxSupply, null);
  assert.equal(bare.change7d, null);
  assert.deepEqual(bare.spark, []);
});

test("CoinPaprika ticker maps and gets a CoinGecko-style id", () => {
  assert.equal(cgIdFromPaprika("btc-bitcoin"), "bitcoin");
  assert.equal(cgIdFromPaprika("shib-shiba-inu"), "shiba-inu");
  const coin = mapPaprikaTicker({
    id: "eth-ethereum",
    name: "Ethereum",
    symbol: "ETH",
    rank: 2,
    circulating_supply: 120000000,
    total_supply: 120000000,
    max_supply: 0,
    quotes: { USD: { price: 3100, volume_24h: 15e9, market_cap: 372e9, percent_change_1h: 0.1, percent_change_24h: -1, percent_change_7d: 2 } },
  })!;
  assert.equal(coin.id, "ethereum");
  assert.equal(coin.symbol, "ETH");
  assert.equal(coin.maxSupply, null);
  assert.equal(coin.fdv, 120000000 * 3100);
  assert.equal(coin.image, "https://static.coinpaprika.com/coin/eth-ethereum/logo.png");
  assert.deepEqual(coin.spark, []);
});

test("global stats from both sources", () => {
  const cg = mapCgGlobal({
    data: {
      active_cryptocurrencies: 17000,
      markets: 1200,
      total_market_cap: { usd: 2.3e12 },
      total_volume: { usd: 8.5e10 },
      market_cap_percentage: { btc: 54.1, eth: 12.3 },
      market_cap_change_percentage_24h_usd: 1.23,
    },
  })!;
  assert.equal(cg.marketCap, 2.3e12);
  assert.equal(cg.btcDominance, 54.1);
  assert.equal(cg.ethDominance, 12.3);
  const pp = mapPaprikaGlobal({ market_cap_usd: 2.2e12, volume_24h_usd: 9e10, bitcoin_dominance_percentage: 55, cryptocurrencies_number: 9000, market_cap_change_24h: -0.5 })!;
  assert.equal(pp.coins, 9000);
  assert.equal(pp.ethDominance, null);
  assert.equal(mapCgGlobal({}), null);
});

test("trending and search results", () => {
  const trending = mapCgTrending({
    coins: [{ item: { id: "pepe", name: "Pepe", symbol: "pepe", market_cap_rank: 30, small: "https://x.test/pepe.png", data: { price: 0.0000123, price_change_percentage_24h: { usd: 12.5 } } } }],
  });
  assert.deepEqual(trending[0], { id: "pepe", name: "Pepe", symbol: "PEPE", image: "https://x.test/pepe.png", rank: 30, price: 0.0000123, change24h: 12.5 });
  const hits = mapCgSearch({ coins: [{ id: "solana", name: "Solana", symbol: "SOL", market_cap_rank: 5, thumb: "https://x.test/sol.png" }] });
  assert.equal(hits[0]!.symbol, "SOL");
});

test("coin record: Russian description when present, safe links only", () => {
  const info = mapCgCoin(
    {
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      market_cap_rank: 1,
      categories: ["Cryptocurrency", "Layer 1 (L1)", null],
      description: { en: "<p>Bitcoin is <a href=\"https://bitcoin.org\">digital money</a>.</p>", ru: "Биткоин &mdash; <b>цифровые</b> деньги." },
      links: {
        homepage: ["javascript:alert(1)", "https://bitcoin.org/"],
        whitepaper: "https://bitcoin.org/bitcoin.pdf",
        blockchain_site: ["https://mempool.space/", ""],
        repos_url: { github: ["https://github.com/bitcoin/bitcoin"] },
        twitter_screen_name: "bitcoin",
        subreddit_url: "https://www.reddit.com/r/Bitcoin/",
        telegram_channel_identifier: "",
      },
      image: { large: "https://x.test/btc-large.png" },
      genesis_date: "2009-01-03",
      market_data: {
        current_price: { usd: 64000 },
        market_cap: { usd: 1.26e12 },
        total_volume: { usd: 3e10 },
        high_24h: { usd: 65000 },
        low_24h: { usd: 63000 },
        ath: { usd: 73800 },
        ath_date: { usd: "2024-03-14T07:10:36.635Z" },
        ath_change_percentage: { usd: -13.2 },
        price_change_percentage_24h: 1.1,
        price_change_percentage_1y_in_currency: { usd: 120 },
        circulating_supply: 19700000,
        max_supply: 21000000,
      },
    },
    "ru",
  )!;
  assert.equal(info.description, "Биткоин — цифровые деньги.");
  assert.equal(info.links.homepage, "https://bitcoin.org/");
  assert.deepEqual(info.links.explorers, ["https://mempool.space/"]);
  assert.equal(info.links.twitter, "https://x.com/bitcoin");
  assert.equal(info.links.telegram, null);
  assert.deepEqual(info.categories, ["Cryptocurrency", "Layer 1 (L1)"]);
  assert.equal(info.change24h, 1.1);
  assert.equal(info.change1y, 120);
  assert.equal(info.high24h, 65000);
  const en = mapCgCoin({ id: "x", market_data: { current_price: { usd: 1 } }, description: { en: "<p>One.</p><p>Two &amp; three.</p>", ru: "" } }, "ru")!;
  assert.equal(en.description, "One.\n\nTwo & three.");
});

test("plain text and url guards", () => {
  assert.equal(plainText("a<br>b &#39;c&#39; &lt;tag&gt;"), "a\nb 'c' <tag>");
  assert.ok(plainText("x. ".repeat(2000), 100).endsWith("…"));
  assert.equal(safeUrl("ftp://x"), null);
  assert.equal(safeUrl("not a url"), null);
  assert.equal(safeUrl(" https://ok.test/a "), "https://ok.test/a");
});

test("thin keeps the ends and the requested size", () => {
  const values = Array.from({ length: 168 }, (_, i) => i);
  const out = thin(values, 42);
  assert.equal(out.length, 42);
  assert.equal(out[0], 0);
  assert.equal(out.at(-1), 167);
  assert.deepEqual(thin([1, 2, 3], 42), [1, 2, 3]);
});

test("history from Binance candles and CoinGecko prices", () => {
  const candles = historyFromKlines([
    [2000, "2", "3", "1", "2.5", "10", 2999, "25", 1, "5", "12", "0"],
    [1000, "1", "2", "0.5", "2", "10", 1999, "20", 1, "5", "10", "0"],
    ["bad"],
  ]);
  assert.deepEqual(candles, [
    { t: 1000, o: 1, h: 2, l: 0.5, c: 2, v: 20 },
    { t: 2000, o: 2, h: 3, l: 1, c: 2.5, v: 25 },
  ]);
  const line = historyFromCgChart({ prices: [[2, 11], [1, 10]], total_volumes: [[1, 100.4], [2, 200]] });
  assert.deepEqual(line, [
    { t: 1, o: 10, h: 10, l: 10, c: 10, v: 100 },
    { t: 2, o: 11, h: 11, l: 11, c: 11, v: 200 },
  ]);
});

test("top-N cap series sums sparkline × supply point by point", () => {
  const coin = (price: number, supply: number) => ({
    ...mapCgMarket({ ...cgBitcoin, sparkline_in_7d: { price: Array(168).fill(price) } })!,
    circulating: supply,
  });
  const series = capSeries([coin(10, 1), coin(20, 2), coin(1, 100), coin(5, 10), coin(2, 50)]);
  assert.equal(series.length, SPARK_POINTS);
  assert.equal(series[0], 10 + 40 + 100 + 50 + 100);
  assert.deepEqual(capSeries([coin(1, 1)]), []);
});
