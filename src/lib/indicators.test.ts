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

test("strong trend has high ADX and the right DI on top", () => {
  const up = computeTechnicals(candles(Array.from({ length: 80 }, (_, i) => 100 * 1.01 ** i)));
  assert.ok(up.adx > 25, `adx ${up.adx}`);
  assert.ok(up.plusDI > up.minusDI);
  assert.equal(up.obvTrend, "up");
  const flat = computeTechnicals(candles(Array.from({ length: 80 }, (_, i) => 100 + (i % 2 ? 0.5 : -0.5))));
  assert.ok(flat.adx < 20, `flat adx ${flat.adx}`);
});

test("bollinger %B and stoch RSI stay in sensible ranges", () => {
  const tech = computeTechnicals(candles(Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 4) * 5)));
  assert.ok(tech.bbPercentB > -1 && tech.bbPercentB < 2);
  assert.ok(tech.stochK >= 0 && tech.stochK <= 100);
  assert.ok(tech.bbWidth > 0);
});

test("score is bounded and a disagreeing higher timeframe weakens the call", () => {
  const closes = Array.from({ length: 80 }, (_, i) => 100 + i * 0.8 + (i % 3 === 0 ? -3 : 0.4));
  const tech = computeTechnicals(candles(closes));
  const alone = technicalSignal(tech);
  const agree = technicalSignal(tech, "up");
  const against = technicalSignal(tech, "down");
  for (const s of [alone, agree, against]) assert.ok(s.score >= -100 && s.score <= 100);
  assert.ok(agree.score > alone.score);
  assert.ok(against.score < alone.score);
  assert.ok(alone.factors.length > 0);
  assert.match(alone.reason, /\.$/);
});

test("backtest only counts trades it can grade", async () => {
  const { backtestSignals } = await import("./indicators.ts");
  const rising = candles(Array.from({ length: 160 }, (_, i) => 100 + i * 0.8 + (i % 3 === 0 ? -3 : 0.4)));
  const bt = backtestSignals(rising, 6, 60);
  assert.ok(bt.trades > 0);
  assert.ok(bt.wins <= bt.trades);
  assert.ok(bt.hitRate >= 0 && bt.hitRate <= 100);
  assert.deepEqual(backtestSignals(rising.slice(0, 50)), { trades: 0, wins: 0, hitRate: 0, avgMovePct: 0 });
});
