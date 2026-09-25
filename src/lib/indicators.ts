import type { Backtest, Candle, CoinSignal, Signal, SignalFactor, Technicals } from "./types";

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

/** Bollinger(20, 2) of the last close: position inside the bands and band width. */
function bollinger(values: number[], period = 20, mult = 2): { percentB: number; width: number } {
  if (values.length < period) return { percentB: 0.5, width: 0 };
  const win = values.slice(-period);
  const mean = win.reduce((s, v) => s + v, 0) / period;
  const sd = Math.sqrt(win.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
  if (sd === 0 || mean === 0) return { percentB: 0.5, width: 0 };
  const upper = mean + mult * sd;
  const lower = mean - mult * sd;
  return { percentB: (values.at(-1)! - lower) / (upper - lower), width: ((upper - lower) / mean) * 100 };
}

/** RSI series (Wilder), one value per close from index `period` on. */
function rsiSeries(values: number[], period = 14): number[] {
  const out: number[] = [];
  if (values.length < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  const push = () => out.push(gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  push();
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    push();
  }
  return out;
}

/** Stochastic RSI %K (14, 14, smoothed over 3). Neutral 50 without enough data. */
function stochRsi(values: number[], period = 14, smooth = 3): number {
  const r = rsiSeries(values, period);
  if (r.length < period + smooth) return 50;
  const raw: number[] = [];
  for (let i = period - 1; i < r.length; i++) {
    const win = r.slice(i - period + 1, i + 1);
    const lo = Math.min(...win);
    const hi = Math.max(...win);
    raw.push(hi === lo ? 50 : ((r[i]! - lo) / (hi - lo)) * 100);
  }
  const tail = raw.slice(-smooth);
  return tail.reduce((s, v) => s + v, 0) / tail.length;
}

/** ADX with +DI / -DI (Wilder, 14). */
function adxOf(candles: Candle[], period = 14): { adx: number; plusDI: number; minusDI: number } {
  if (candles.length < period * 2 + 1) return { adx: 0, plusDI: 0, minusDI: 0 };
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const p = candles[i - 1]!;
    const up = c.h - p.h;
    const down = p.l - c.l;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  let sTr = tr.slice(0, period).reduce((s, v) => s + v, 0);
  let sPlus = plusDM.slice(0, period).reduce((s, v) => s + v, 0);
  let sMinus = minusDM.slice(0, period).reduce((s, v) => s + v, 0);
  const dx: number[] = [];
  let plusDI = 0;
  let minusDI = 0;
  for (let i = period; i <= tr.length; i++) {
    if (i > period) {
      sTr = sTr - sTr / period + tr[i - 1]!;
      sPlus = sPlus - sPlus / period + plusDM[i - 1]!;
      sMinus = sMinus - sMinus / period + minusDM[i - 1]!;
    }
    plusDI = sTr > 0 ? (sPlus / sTr) * 100 : 0;
    minusDI = sTr > 0 ? (sMinus / sTr) * 100 : 0;
    const sum = plusDI + minusDI;
    dx.push(sum > 0 ? (Math.abs(plusDI - minusDI) / sum) * 100 : 0);
  }
  return { adx: wilder(dx, period), plusDI, minusDI };
}

/** On-balance volume direction over the last `lookback` candles, relative to its typical step. */
function obvTrendOf(candles: Candle[], lookback = 10): Technicals["obvTrend"] {
  if (candles.length < lookback + 2) return "flat";
  let obv = 0;
  const series: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const p = candles[i - 1]!;
    obv += c.c > p.c ? c.v : c.c < p.c ? -c.v : 0;
    series.push(obv);
  }
  const change = series.at(-1)! - series.at(-1 - lookback)!;
  const recentVol = candles.slice(-lookback).reduce((s, c) => s + c.v, 0);
  if (recentVol <= 0) return "flat";
  const share = change / recentVol;
  return share > 0.2 ? "up" : share < -0.2 ? "down" : "flat";
}

/** MACD histogram series (line minus signal), aligned to the end of `values`. */
function macdHistogram(values: number[]): number[] {
  const fast = emaSeries(values, 12);
  const slow = emaSeries(values, 26);
  const line: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const f = fast[i];
    const sl = slow[i];
    if (f !== null && sl !== null) line.push(f - sl);
  }
  const sig = emaSeries(line, 9);
  const hist: number[] = [];
  for (let i = 0; i < line.length; i++) {
    const sv = sig[i];
    if (sv !== null && sv !== undefined) hist.push(line[i]! - sv);
  }
  return hist;
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

export function computeTechnicals(candles: Candle[]): Technicals {
  const px = closes(candles);
  const last = px.at(-1) ?? 0;
  const ema9 = ema(px, 9);
  const ema21 = ema(px, 21);
  const ema50 = ema(px, 50);
  const { macd, signal } = macdOf(px);
  const hist = macdHistogram(px);
  const macdHistSlope = hist.length >= 4 ? hist.at(-1)! - hist.at(-4)! : 0;

  // Average volume of the 20 candles BEFORE the current one, so the live candle
  // isn't compared against itself.
  const vols = candles.map((c) => c.v);
  const window = vols.slice(-21, -1);
  const avgVol = window.length ? window.reduce((s, v) => s + v, 0) / window.length : 0;
  const volumeRatio = avgVol > 0 ? (vols.at(-1) ?? 0) / avgVol : 1;

  let trend: Technicals["trend"] = "side";
  if (ema9 > ema21 && ema21 > ema50 && last > ema21) trend = "up";
  else if (ema9 < ema21 && ema21 < ema50 && last < ema21) trend = "down";

  const atrValue = atr(candles);
  const bb = bollinger(px);
  const dmi = adxOf(candles);
  const prev10 = px.at(-11);

  return {
    rsi: round(rsi(px), 1),
    ema9: Number(ema9.toPrecision(8)),
    ema21: Number(ema21.toPrecision(8)),
    ema50: Number(ema50.toPrecision(8)),
    macd: Number(macd.toPrecision(6)),
    macdSignal: Number(signal.toPrecision(6)),
    macdHistSlope: Number(macdHistSlope.toPrecision(6)),
    atr: Number(atrValue.toPrecision(8)),
    atrPct: last > 0 ? round((atrValue / last) * 100, 2) : 0,
    volumeRatio: round(volumeRatio, 2),
    trend,
    adx: round(dmi.adx, 1),
    plusDI: round(dmi.plusDI, 1),
    minusDI: round(dmi.minusDI, 1),
    bbPercentB: round(bb.percentB, 2),
    bbWidth: round(bb.width, 2),
    stochK: round(stochRsi(px), 1),
    obvTrend: obvTrendOf(candles),
    roc10: prev10 ? round(((last - prev10) / prev10) * 100, 2) : 0,
  };
}

const FACTOR_RU: Record<SignalFactor["key"], string> = {
  emaStackUp: "EMA 9>21>50 — тренд вверх",
  emaStackDown: "EMA 9<21<50 — тренд вниз",
  emaCrossUp: "EMA9 выше EMA21",
  emaCrossDown: "EMA9 ниже EMA21",
  aboveEma50: "EMA21 выше EMA50",
  belowEma50: "EMA21 ниже EMA50",
  macdBull: "MACD выше сигнальной и ускоряется",
  macdBear: "MACD ниже сигнальной и ускоряется вниз",
  rsiBull: "RSI в бычьей зоне",
  rsiBear: "RSI в медвежьей зоне",
  rsiOverbought: "RSI перекуплен",
  rsiOversold: "RSI перепродан",
  stochLow: "Stoch RSI внизу — возможен отскок",
  stochHigh: "Stoch RSI вверху — возможен откат",
  diBull: "+DI выше −DI: покупатели сильнее",
  diBear: "−DI выше +DI: продавцы сильнее",
  obvUp: "объём подтверждает рост (OBV)",
  obvDown: "объём подтверждает падение (OBV)",
  bbUpper: "цена у верхней полосы Боллинджера",
  bbLower: "цена у нижней полосы Боллинджера",
  adxWeak: "ADX низкий — рынок без тренда",
  adxStrong: "ADX высокий — сильный тренд",
  volumeSpike: "всплеск объёма",
  higherTfAgrees: "старший таймфрейм согласен",
  higherTfAgainst: "старший таймфрейм против",
};

export function factorTextRu(factor: SignalFactor): string {
  const base = FACTOR_RU[factor.key];
  return factor.value !== undefined ? `${base} (${factor.value})` : base;
}

/** Score needed for a LONG/SHORT call. Below it the honest answer is "wait". */
export const SIGNAL_THRESHOLD = 30;

/**
 * Pure technical verdict — no AI, instant, works for a whole grid at once.
 *
 * Each indicator adds or subtracts points; the total decides the signal. ADX
 * scales the result: in a choppy market (low ADX) trend signals are unreliable,
 * so the score is shrunk toward zero; in a strong trend it is amplified.
 * `higherTrend` (optional) is the trend on the next timeframe up.
 */
export function technicalSignal(tech: Technicals, higherTrend?: Technicals["trend"]): CoinSignal {
  const factors: SignalFactor[] = [];
  const add = (key: SignalFactor["key"], weight: number, value?: number) => factors.push({ key, weight, value });

  if (tech.trend === "up") add("emaStackUp", 22);
  else if (tech.trend === "down") add("emaStackDown", -22);
  else if (tech.ema9 > tech.ema21) add("emaCrossUp", 8);
  else if (tech.ema9 < tech.ema21) add("emaCrossDown", -8);

  if (tech.ema50 > 0) {
    const lastAboveEma50 = tech.ema21 > tech.ema50;
    add(lastAboveEma50 ? "aboveEma50" : "belowEma50", lastAboveEma50 ? 6 : -6);
  }

  if (tech.macd > tech.macdSignal && tech.macdHistSlope > 0) add("macdBull", 14);
  else if (tech.macd < tech.macdSignal && tech.macdHistSlope < 0) add("macdBear", -14);

  if (tech.rsi >= 72) add("rsiOverbought", -14, tech.rsi);
  else if (tech.rsi <= 28) add("rsiOversold", 14, tech.rsi);
  else if (tech.rsi >= 52 && tech.rsi < 68) add("rsiBull", 8, tech.rsi);
  else if (tech.rsi <= 48 && tech.rsi > 32) add("rsiBear", -8, tech.rsi);

  if (tech.stochK <= 15) add("stochLow", 6, tech.stochK);
  else if (tech.stochK >= 85) add("stochHigh", -6, tech.stochK);

  if (tech.adx >= 18) {
    if (tech.plusDI > tech.minusDI + 3) add("diBull", 10);
    else if (tech.minusDI > tech.plusDI + 3) add("diBear", -10);
  }

  if (tech.obvTrend === "up") add("obvUp", 8);
  else if (tech.obvTrend === "down") add("obvDown", -8);

  if (tech.bbPercentB > 1) add("bbUpper", -8, tech.bbPercentB);
  else if (tech.bbPercentB < 0) add("bbLower", 8, tech.bbPercentB);

  if (higherTrend === "up" || higherTrend === "down") {
    const raw = factors.reduce((s, f) => s + f.weight, 0);
    const agrees = (higherTrend === "up" && raw > 0) || (higherTrend === "down" && raw < 0);
    if (raw !== 0) add(agrees ? "higherTfAgrees" : "higherTfAgainst", (agrees ? 1 : -1) * Math.sign(raw) * 12);
  }

  let score = factors.reduce((s, f) => s + f.weight, 0);
  if (tech.adx > 0 && tech.adx < 18) {
    score *= 0.6;
    factors.push({ key: "adxWeak", weight: 0, value: tech.adx });
  } else if (tech.adx >= 25) {
    score *= 1.15;
    factors.push({ key: "adxStrong", weight: 0, value: tech.adx });
  }
  if (tech.volumeRatio >= 1.8 && Math.abs(score) >= 15) {
    score *= 1.1;
    factors.push({ key: "volumeSpike", weight: 0, value: tech.volumeRatio });
  }
  score = Math.max(-100, Math.min(100, Math.round(score)));

  const signal: Signal = score >= SIGNAL_THRESHOLD ? "LONG" : score <= -SIGNAL_THRESHOLD ? "SHORT" : "WAIT";
  // Confidence grows with the strength of agreement but is capped: indicators
  // alone never justify certainty.
  const confidence =
    signal === "WAIT" ? Math.round(55 - Math.abs(score) * 0.5) : Math.min(85, Math.round(45 + Math.abs(score) * 0.5));

  const ranked = [...factors].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const leading = ranked
    .filter((f) => (signal === "LONG" ? f.weight > 0 : signal === "SHORT" ? f.weight < 0 : f.weight !== 0))
    .slice(0, 3);
  const context = ranked.filter((f) => f.weight === 0);
  const head =
    signal === "LONG"
      ? "Перевес у покупателей"
      : signal === "SHORT"
        ? "Перевес у продавцов"
        : "Чёткого перевеса нет — лучше подождать";
  const reason = [head, ...[...leading, ...context].map(factorTextRu)].join("; ") + ".";

  return { signal, confidence, score, factors: ranked, reason };
}

/**
 * Walk-forward check of the signal rule on this coin's own history: at each
 * past candle, compute the signal from data up to that point only, then see
 * whether price moved the right way over the next `horizon` candles by more
 * than a quarter of an ATR. Honest by construction — no future data leaks in.
 */
export function backtestSignals(candles: Candle[], horizon = 6, warmup = 60): Backtest {
  let trades = 0;
  let wins = 0;
  let moveSum = 0;
  for (let i = warmup; i + horizon < candles.length; i++) {
    const hist = candles.slice(0, i + 1);
    const tech = computeTechnicals(hist);
    const { signal } = technicalSignal(tech);
    if (signal === "WAIT") continue;
    const entry = candles[i]!.c;
    const exit = candles[i + horizon]!.c;
    if (!(entry > 0)) continue;
    const move = ((exit - entry) / entry) * 100 * (signal === "LONG" ? 1 : -1);
    const threshold = (tech.atrPct || 0) * 0.25;
    trades += 1;
    moveSum += move;
    if (move > threshold) wins += 1;
  }
  return {
    trades,
    wins,
    hitRate: trades ? Math.round((wins / trades) * 100) : 0,
    avgMovePct: trades ? round(moveSum / trades, 2) : 0,
  };
}
