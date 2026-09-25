import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTechnicals, technicalSignal } from "./indicators.ts";
import type { Candle } from "./types.ts";

function candles(closes: number[], volume = 100): Candle[] {
  return closes.map((c, i) => ({ t: i * 3_600_000, o: c, h: c * 1.001, l: c * 0.999, c, v: volume }));
}

test("flat market is neutral, not overbought", () => {
  const tech = computeTechnicals(candles(Array(60).fill(100)));
  assert.equal(tech.rsi, 50);
  assert.equal(tech.trend, "side");
  assert.equal(technicalSignal(tech).signal, "WAIT");
});

test("steady uptrend reads as up with high RSI", () => {
  const tech = computeTechnicals(candles(Array.from({ length: 60 }, (_, i) => 100 + i)));
  assert.equal(tech.trend, "up");
  assert.ok(tech.rsi > 70, `rsi ${tech.rsi}`);
  assert.ok(tech.ema9 > tech.ema21 && tech.ema21 > tech.ema50);
});

test("steady downtrend reads as down", () => {
  const tech = computeTechnicals(candles(Array.from({ length: 60 }, (_, i) => 200 - i)));
  assert.equal(tech.trend, "down");
  assert.ok(tech.rsi < 30, `rsi ${tech.rsi}`);
});

test("uptrend with a pullback gives a LONG, and a volume spike raises confidence", () => {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.8 + (i % 3 === 0 ? -3 : 0.4));
  const base = technicalSignal(computeTechnicals(candles(closes)));
  assert.equal(base.signal, "LONG");
  const spiked = candles(closes);
  spiked[spiked.length - 1] = { ...spiked.at(-1)!, v: 500 };
  const boosted = technicalSignal(computeTechnicals(spiked));
  assert.ok(boosted.confidence > base.confidence);
});

test("short history does not crash and stays neutral", () => {
  const tech = computeTechnicals(candles([100, 101]));
  assert.equal(tech.rsi, 50);
  assert.equal(technicalSignal(tech).signal, "WAIT");
});
