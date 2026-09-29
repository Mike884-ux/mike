import { test } from "node:test";
import assert from "node:assert/strict";
import { applyScreen, isHighVolume, matches, needsTech, PRESETS, usesProFilters, type ScreenRow } from "./screener.ts";

function row(symbol: string, over: Partial<ScreenRow> = {}): ScreenRow {
  return {
    id: symbol.toLowerCase(),
    rank: 1,
    symbol,
    name: symbol,
    image: null,
    price: 1,
    change1h: 0,
    change24h: 0,
    change7d: 0,
    marketCap: 1_000_000_000,
    volume24h: 10_000_000,
    circulating: null,
    totalSupply: null,
    maxSupply: null,
    fdv: null,
    spark: [],
    tech: null,
    ...over,
  };
}

const tech = (signal: "LONG" | "SHORT" | "WAIT", score: number, rsi = 50, volumeRatio = 1) => ({
  signal,
  score,
  confidence: 60,
  rsi,
  volumeRatio,
});

test("gainers and losers presets use the 24h change bounds", () => {
  const rows = [row("A", { change24h: 12 }), row("B", { change24h: 3 }), row("C", { change24h: -15 }), row("D", { change24h: null })];
  assert.deepEqual(applyScreen(rows, PRESETS.gainers.filters, "change24h", "desc").map((r) => r.symbol), ["A"]);
  assert.deepEqual(applyScreen(rows, PRESETS.losers.filters, "change24h", "asc").map((r) => r.symbol), ["C"]);
});

test("an unknown value never passes a set bound", () => {
  assert.equal(matches(row("X", { marketCap: null }), PRESETS.smallCap.filters), false);
  assert.equal(matches(row("X", { marketCap: 50_000_000 }), PRESETS.smallCap.filters), true);
  assert.equal(matches(row("X", { marketCap: null }), {}), true, "no filter keeps everything");
});

test("high volume: turnover or volume spike", () => {
  assert.equal(isHighVolume(row("A", { marketCap: 100, volume24h: 30 })), true);
  assert.equal(isHighVolume(row("B", { marketCap: 100, volume24h: 5, tech: tech("WAIT", 0, 50, 2) })), true);
  assert.equal(isHighVolume(row("C", { marketCap: 100, volume24h: 5 })), false);
});

test("signal and RSI filters only match coins with technicals", () => {
  const rows = [
    row("LONG", { tech: tech("LONG", 62, 58) }),
    row("WEAK", { tech: tech("LONG", 35, 55) }),
    row("SHORT", { tech: tech("SHORT", -70, 25) }),
    row("NONE"),
  ];
  assert.deepEqual(applyScreen(rows, { signal: "strong" }, "score", "desc").map((r) => r.symbol), ["SHORT", "LONG"]);
  assert.deepEqual(applyScreen(rows, { signal: "long" }).map((r) => r.symbol), ["LONG", "WEAK"]);
  assert.deepEqual(applyScreen(rows, PRESETS.oversold.filters).map((r) => r.symbol), ["SHORT"]);
  assert.equal(needsTech(PRESETS.oversold.filters), true);
  assert.equal(needsTech(PRESETS.gainers.filters), false);
});

test("rows without the sort value go last", () => {
  const rows = [row("A", { change7d: null }), row("B", { change7d: 5 }), row("C", { change7d: 9 })];
  assert.deepEqual(applyScreen(rows, {}, "change7d", "desc").map((r) => r.symbol), ["C", "B", "A"]);
  assert.deepEqual(applyScreen(rows, {}, "change7d", "asc").map((r) => r.symbol), ["B", "C", "A"]);
});

test("only 24h change and market cap are free custom filters", () => {
  assert.equal(usesProFilters({ change24h: { min: 5 }, marketCap: { max: 1e9 } }), false);
  assert.equal(usesProFilters({ change24h: {}, signal: "any", highVolume: false }), false, "empty values are not filters");
  assert.equal(usesProFilters({ rsi: { max: 30 } }), true);
  assert.equal(usesProFilters({ volumeMin: 1e6 }), true);
  assert.equal(usesProFilters({ change7d: { min: 1 } }), true);
});
