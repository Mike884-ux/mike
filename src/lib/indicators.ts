import type { Candle, CoinSignal, Signal, Technicals } from "./types";

function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.c);
}

/**
 * Full EMA series, seeded with the SMA of the first `period` values.
 * Index i of the result corresponds to index i of `values`; positions before
 * the warm-up is complete are `null` so callers can't silently use them.
 */
function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period || period < 1) return out;
  const k = 2 / (period + 1);
  let avg = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  out[period - 1] = avg;
  for (let i = period; i < values.length; i++) {
    avg = values[i]! * k + avg * (1 - k);
    out[i] = avg;
  }
  return out;
}

/** Last value of the EMA series, or 0 when there isn't enough data. */
function ema(values: number[], period: number): number {
  const series = emaSeries(values, period);
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v !== null) return v;
  }
  return values.at(-1) ?? 0;
}

/**
 * Wilder's smoothing (alpha = 1/period) — what RSI and ATR are defined with.
 * Deliberately NOT the same as ema(), whose alpha is 2/(period+1).
 */
function wilder(values: number[], period: number): number {
  if (!values.length) return 0;
  if (values.length < period) return values.reduce((s, v) => s + v, 0) / values.length;
  let avg = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < values.length; i++) {
    avg = (avg * (period - 1) + values[i]!) / period;
  }
  return avg;
}

function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i]! - values[i - 1]!;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    gain = (gain * (period - 1) + Math.max(diff, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  // A perfectly flat series has no gains AND no losses: that's neutral (50),
  // not "overbought" (100), which used to flag flat markets as a sell-risk.
  if (gain === 0 && loss === 0) return 50;
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

/** True Range series, one entry per candle after the first. */
function trueRanges(candles: Candle[]): number[] {
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const prev = candles[i - 1]!;
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c)));
  }
  return trs;
}

/**
 * ATR with Wilder smoothing — matches TradingView and every standard terminal.
 * The previous version used ema() (alpha 2/15 instead of 1/14), which produced
 * a noticeably faster ATR that didn't line up with any chart the user compares against.
 */
function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  return wilder(trueRanges(candles), period);
}

/**
 * MACD line and its signal line, built from ONE consistent EMA implementation.
 *
 * The previous version computed the MACD line with the seeded ema() helper but
 * built the history series for the signal line with a second, differently-seeded
 * EMA written inline. The two disagreed by ~2%, so `macd >= macdSignal` compared
 * values from different series — harmless far from a crossover, but wrong at the
 * exact moment a crossover signal is supposed to fire.
 */
function macdOf(values: number[]): { macd: number; signal: number } {
  const fast = emaSeries(values, 12);
  const slow = emaSeries(values, 26);

  // MACD line is only defined where BOTH EMAs have finished warming up.
  const line: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const f = fast[i];
    const s = slow[i];
    if (f !== null && s !== null) line.push(f - s);
  }
  if (!line.length) return { macd: 0, signal: 0 };

  return { macd: line.at(-1)!, signal: ema(line, 9) };
}

export function computeTechnicals(candles: Candle[]): Technicals {
  const px = closes(candles);
  const last = px.at(-1) ?? 0;
  const ema9 = ema(px, 9);
  const ema21 = ema(px, 21);
  const ema50 = ema(px, 50);
  const { macd, signal } = macdOf(px);

  // Average volume of the 20 candles BEFORE the current one, so the live candle
  // isn't compared against itself. Divide by the slice's own length rather than
  // a separately-computed guess, so a short history can't skew the ratio.
  const vols = candles.map((c) => c.v);
  const window = vols.slice(-21, -1);
  const avgVol = window.length ? window.reduce((s, v) => s + v, 0) / window.length : 0;
  const volumeRatio = avgVol > 0 ? (vols.at(-1) ?? 0) / avgVol : 1;

  let trend: Technicals["trend"] = "side";
  if (ema9 > ema21 && ema21 > ema50 && last > ema21) trend = "up";
  else if (ema9 < ema21 && ema21 < ema50 && last < ema21) trend = "down";

  return {
    rsi: Number(rsi(px).toFixed(1)),
    ema9: Number(ema9.toPrecision(8)),
    ema21: Number(ema21.toPrecision(8)),
    ema50: Number(ema50.toPrecision(8)),
    macd: Number(macd.toPrecision(6)),
    macdSignal: Number(signal.toPrecision(6)),
    atr: Number(atr(candles).toPrecision(8)),
    volumeRatio: Number(volumeRatio.toFixed(2)),
    trend,
  };
}

/** Pure technical-indicator verdict — no AI, instant, works for a whole grid at once. */
export function technicalSignal(tech: Technicals): CoinSignal {
  let signal: Signal = "WAIT";
  let confidence = 42;
  let reason = "Нет чёткого края — тренд боковой или сигналы противоречат друг другу.";

  if (tech.trend === "up" && tech.rsi < 68 && tech.rsi > 42 && tech.macd >= tech.macdSignal) {
    signal = "LONG";
    confidence = 58;
    reason = `Тренд вверх (EMA9>21>50), RSI ${tech.rsi} без перекупленности, MACD подтверждает.`;
  } else if (tech.trend === "down" && tech.rsi > 32 && tech.rsi < 58 && tech.macd <= tech.macdSignal) {
    signal = "SHORT";
    confidence = 56;
    reason = `Тренд вниз (EMA9<21<50), RSI ${tech.rsi}, MACD подтверждает давление продавцов.`;
  } else if (tech.rsi >= 72) {
    signal = "WAIT";
    confidence = 48;
    reason = `RSI ${tech.rsi} — перекуплено, входить на хае рискованно.`;
  } else if (tech.rsi <= 28) {
    signal = "WAIT";
    confidence = 48;
    reason = `RSI ${tech.rsi} — перепродано, ждать разворотного подтверждения.`;
  }

  if (tech.volumeRatio >= 1.8 && signal !== "WAIT") {
    confidence = Math.min(78, confidence + 8);
    reason += ` Объём выше среднего в ${tech.volumeRatio}x.`;
  }

  return { signal, confidence, reason };
}
