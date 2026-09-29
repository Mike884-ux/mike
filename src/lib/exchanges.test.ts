import { test } from "node:test";
import assert from "node:assert/strict";
import { exchangePairs, resetExchangePairs } from "./exchange-pairs.server.ts";
import { EXCHANGES, rankExchanges, tradeUrl, type ExchangePairs } from "./exchanges.ts";

const all = (quotes: ExchangePairs[keyof ExchangePairs]) => Object.fromEntries(EXCHANGES.map((e) => [e, quotes])) as ExchangePairs;

test("the best available exchange is recommended, the next one is the alternative", () => {
  const r = rankExchanges({ country: "TJ", pairs: all(["USDT"]) });
  assert.equal(r.recommended?.id, "binance");
  assert.equal(r.alternative?.id, "okx");
  assert.equal(r.rest.length, 4);
});

test("a partner link never beats the visitor's country or the coin's market", () => {
  // Binance is blocked in Russia: its referral code must not lift it.
  const russia = rankExchanges({ country: "RU", pairs: all(["USDT"]), refs: { binance: "CODE" } });
  assert.notEqual(russia.recommended?.id, "binance");
  assert.notEqual(russia.alternative?.id, "binance");
  assert.equal(russia.rest.at(-1)?.id, "binance");
  // The coin isn't listed on OKX: a partner code there doesn't help either.
  const pairs = { ...all(["USDT"]), okx: [] };
  const r = rankExchanges({ country: "TJ", pairs, refs: { okx: "CODE" } });
  assert.notEqual(r.recommended?.id, "okx");
  assert.notEqual(r.alternative?.id, "okx");
});

test("a partner link doesn't lift a weaker exchange over a stronger one", () => {
  const pairs = all([]);
  pairs.bitget = ["USDT"];
  pairs.kucoin = ["USDT"];
  const r = rankExchanges({ country: "TJ", pairs, refs: { kucoin: "X" } });
  assert.equal(r.recommended?.id, "bitget");
  assert.equal(r.alternative?.id, "kucoin");
  assert.equal(r.alternative?.partner, true);
});

test("the visitor's own exchange comes first", () => {
  const r = rankExchanges({ country: "TJ", pairs: all(["USDT"]), favorite: "mexc" });
  assert.equal(r.recommended?.id, "mexc");
  assert.equal(r.recommended?.favorite, true);
});

test("a blocked exchange is never recommended, even as the favourite", () => {
  const us = rankExchanges({ country: "US", pairs: all(["USDT"]), favorite: "binance" });
  assert.equal(us.recommended, null);
  assert.equal(us.alternative, null);
  assert.equal(us.rest.length, 6);
});

test("the pair to open: USDT when listed, else what is there", () => {
  const pairs = { ...all(["USDT"]), kucoin: ["USDC" as const, "BTC" as const] };
  const r = rankExchanges({ country: "TJ", pairs });
  const kucoin = [r.recommended, r.alternative, ...r.rest].find((x) => x?.id === "kucoin");
  assert.equal(kucoin?.quote, "USDC");
  assert.equal(r.recommended?.quote, "USDT");
});

test("links carry the referral code the way each exchange expects", () => {
  assert.equal(tradeUrl("binance", "btc", "ABC"), "https://www.binance.com/en/trade/BTC_USDT?type=spot&ref=ABC");
  assert.equal(tradeUrl("kucoin", "ETH", "R1", "USDC"), "https://www.kucoin.com/trade/ETH-USDC?rcode=R1");
  assert.equal(tradeUrl("mexc", "SOL", null), "https://www.mexc.com/exchange/SOL_USDT");
  assert.equal(tradeUrl("okx", "BTC", "https://okx.com/join/MY"), "https://okx.com/join/MY", "a full partner link is used as-is");
});

test("pairs are read from each exchange's public list; a failing one reads as not checked", async () => {
  const real = globalThis.fetch;
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("binance")) return json([{ symbol: "BTCUSDT" }, { symbol: "BTCFDUSD" }, { symbol: "ETHBTC" }]);
    if (url.includes("bybit")) return json({ result: { list: [{ baseCoin: "BTC", quoteCoin: "USDC", status: "Trading" }, { baseCoin: "BTC", quoteCoin: "USDT", status: "Closed" }] } });
    if (url.includes("okx")) return new Response("blocked", { status: 403 });
    if (url.includes("bitget")) return json({ data: [{ baseCoin: "SOL", quoteCoin: "USDT", status: "online" }] });
    if (url.includes("kucoin")) return json({ data: [{ baseCurrency: "BTC", quoteCurrency: "USDT", enableTrading: true }] });
    return json({ data: ["BTCUSDT", "BTCEUR"] });
  }) as typeof fetch;
  try {
    resetExchangePairs();
    const btc = await exchangePairs("btc");
    assert.deepEqual(btc, { binance: ["USDT", "FDUSD"], bybit: ["USDC"], okx: null, bitget: [], kucoin: ["USDT"], mexc: ["USDT", "EUR"] });
    assert.deepEqual((await exchangePairs("ETH")).binance, ["BTC"]);
  } finally {
    globalThis.fetch = real;
    resetExchangePairs();
  }
});
