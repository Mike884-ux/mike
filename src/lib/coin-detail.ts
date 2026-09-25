import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { computeTechnicals, technicalSignal } from "./indicators";
import { assetOf, symbolOf } from "./markets";
import { allow } from "./rate-limit";
import { asInterval, type AiLevels, type Candle, type Signal } from "./types";

export type CoinChartData = {
  price: number;
  change24h: number;
  rsi: number;
  trend: "up" | "down" | "side";
  signal: Signal;
  confidence: number;
  reason: string;
  candles: Candle[];
};

/** Lets the detail view switch timeframe on its own, independent of the scanner's global interval. */
export const getCoinChart = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { base?: string; interval?: string }) => ({
    base: String(input.base ?? "").toUpperCase(),
    interval: asInterval(input.interval),
  }))
  .handler(async ({ data }): Promise<CoinChartData | null> => {
    const asset = assetOf(data.base);
    if (!data.base || !asset) return null;
    const marketMod = await import("./market.server");
    const symbol = symbolOf(asset);
    let [candles, tickers] = await Promise.all([
      marketMod.fetchKlines(symbol, data.interval, 60),
      marketMod.fetchTickers([symbol]),
    ]);
    // A flaky network hop can starve a single fetch — worth one retry before
    // giving up and showing the user a "couldn't load this timeframe" state.
    if (candles.length < 20) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      [candles, tickers] = await Promise.all([
        marketMod.fetchKlines(symbol, data.interval, 60),
        tickers.length ? Promise.resolve(tickers) : marketMod.fetchTickers([symbol]),
      ]);
    }
    if (candles.length < 20) return null;
    const ticker = tickers[0];
    const price = ticker?.price || candles.at(-1)?.c || 0;
    if (!price) return null;
    const tech = computeTechnicals(candles);
    const verdict = technicalSignal(tech);
    return {
      price,
      change24h: ticker?.change24h ?? 0,
      rsi: tech.rsi,
      trend: tech.trend,
      signal: verdict.signal,
      confidence: verdict.confidence,
      reason: verdict.reason,
      candles: candles.slice(-60),
    };
  });

export type CoinExtras = {
  high24h?: number;
  low24h?: number;
  volume?: number;
  buyRatio: number | null;
};

export const getCoinExtras = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { base?: string; interval?: string }) => ({
    base: String(input.base ?? "").toUpperCase(),
    interval: asInterval(input.interval),
  }))
  .handler(async ({ data }): Promise<CoinExtras> => {
    const asset = assetOf(data.base);
    if (!data.base || !asset) return { buyRatio: null };
    const marketMod = await import("./market.server");
    const symbol = symbolOf(asset);
    const [ticker, buyRatio] = await Promise.all([
      marketMod.fetchTickerDetail(symbol),
      marketMod.fetchBuyPressure(symbol, data.interval),
    ]);
    return {
      high24h: ticker?.high24h,
      low24h: ticker?.low24h,
      volume: ticker?.volume,
      buyRatio,
    };
  });

const chartCache = new Map<string, { at: number; value: AiLevels }>();
const CHART_TTL = 180_000;

/**
 * Best-effort recovery for a response cut short mid-stream (seen on this network:
 * a local proxy sometimes truncates AI responses to a few dozen bytes). Pulls
 * whatever fields did arrive via regex instead of requiring valid JSON.
 */
function salvageLevels(raw: string): AiLevels | null {
  const str = (key: string) => raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))?.[1];
  const num = (key: string) => {
    const m = raw.match(new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
    return m ? Number(m[1]) : undefined;
  };
  const reasons: string[] = [];
  const reasonsBlock = raw.match(/"reasons"\s*:\s*\[([\s\S]*)/)?.[1];
  if (reasonsBlock) {
    const re = /"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(reasonsBlock)) && reasons.length < 3) reasons.push(m[1]);
  }
  const directionRaw = raw.match(/"direction"\s*:\s*"(LONG|SHORT|WAIT)"/)?.[1];
  const verdict = str("verdict");
  if (!directionRaw && !verdict) return null;
  const confidence = num("confidence");
  return {
    direction: directionRaw === "LONG" || directionRaw === "SHORT" ? directionRaw : "WAIT",
    confidence: confidence !== undefined ? Math.max(0, Math.min(100, Math.round(confidence))) : 50,
    support: num("support"),
    resistance: num("resistance"),
    entry: num("entry"),
    stopLoss: num("stopLoss"),
    target: num("target"),
    verdict: verdict?.trim() || "Связь оборвалась до того, как ИИ закончил ответ — вот что успело прийти.",
    reasons,
  };
}

export const analyzeChartAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      base?: string;
      interval?: string;
      price?: number;
      rsi?: number;
      trend?: string;
      signal?: string;
      change24h?: number;
      technicalReason?: string;
    }) => ({
      base: String(input.base ?? "").toUpperCase(),
      interval: asInterval(input.interval),
      price: Number(input.price ?? 0),
      rsi: Number(input.rsi ?? 50),
      trend: String(input.trend ?? "side"),
      signal: String(input.signal ?? "WAIT"),
      change24h: Number(input.change24h ?? 0),
      technicalReason: String(input.technicalReason ?? "").slice(0, 300),
    }),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; levels: AiLevels } | { ok: false; error: string }> => {
    if (!data.base || !data.price) return { ok: false, error: "Нет данных по монете." };
    const key = `${data.base}:${data.interval}`;
    const hit = chartCache.get(key);
    if (hit && Date.now() - hit.at < CHART_TTL) return { ok: true, levels: hit.value };
    if (!allow(context.userId, "chart-ai", 15, 180_000)) {
      return { ok: false, error: "Слишком часто. Подожди немного." };
    }
    const { completeAi } = await import("./ai.server");
    const { queryHeadlines } = await import("./news.server");
    const headlines = await queryHeadlines(data.base).catch(() => []);
    const newsBlock = headlines.length
      ? headlines
          .slice(0, 5)
          .map((h) => `- ${h.title}`)
          .join("\n")
      : "";

    const system =
      'Ты трейдер-аналитик. Учитывай и технические индикаторы, и свежие новости по активу (если они есть) — новости могут перевесить технику (например позитивная/негативная новость важнее нейтрального RSI). Верни СТРОГО один JSON-объект, без текста вокруг и без markdown, поля СТРОГО в этом порядке: {"direction":"LONG|SHORT|WAIT","confidence":0-100,"verdict":"1 предложение по-русски с конкретным выводом","reasons":["причина1","причина2","причина3"],"support":число,"resistance":число,"entry":число,"stopLoss":число,"target":число}. Каждая причина (2-3 шт, 5-12 слов) называет конкретную цифру или факт из присланных данных (RSI, % за 24ч, уровень цены, ИЛИ конкретную новость) — без общих фраз вроде "рынок нестабилен". Если среди новостей есть релевантная — хотя бы одна причина должна ссылаться на неё. Цены в support/resistance/entry/stopLoss/target — реалистичные, рядом с текущей ценой. Без инвестиционных советов.';
    const user = [
      `Актив: ${data.base}, таймфрейм ${data.interval}.`,
      `Текущая цена: ${data.price}. Изменение за 24ч: ${data.change24h.toFixed(2)}%.`,
      `RSI: ${data.rsi}. Тренд: ${data.trend}. Технический сигнал: ${data.signal}.`,
      data.technicalReason ? `Технический разбор индикаторов: ${data.technicalReason}` : "",
      newsBlock ? `Свежие новости по активу:\n${newsBlock}` : "Свежих новостей по активу не нашлось.",
    ]
      .filter(Boolean)
      .join("\n");

    let lastError = "ИИ сейчас недоступен. Попробуй через минуту.";
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await completeAi({ system, user, json: true, maxTokens: 700, temperature: 0.3 });
      if (!raw) continue;
      try {
        const jsonText = raw
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const parsed = JSON.parse(jsonText) as Partial<AiLevels>;
        const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || undefined);
        const reasons = Array.isArray(parsed.reasons)
          ? parsed.reasons.map((r) => String(r).trim()).filter(Boolean).slice(0, 3)
          : [];
        const confidence = num(parsed.confidence);
        const levels: AiLevels = {
          direction: parsed.direction === "LONG" || parsed.direction === "SHORT" ? parsed.direction : "WAIT",
          confidence: confidence !== undefined ? Math.max(0, Math.min(100, Math.round(confidence))) : 50,
          support: num(parsed.support),
          resistance: num(parsed.resistance),
          entry: num(parsed.entry),
          stopLoss: num(parsed.stopLoss),
          target: num(parsed.target),
          verdict: String(parsed.verdict ?? "").trim() || "ИИ не дал пояснения.",
          reasons,
        };
        chartCache.set(key, { at: Date.now(), value: levels });
        return { ok: true, levels };
      } catch (err) {
        console.error("[chart-ai] parse failed:", err instanceof Error ? err.message : err, raw.slice(0, 300));
        const salvaged = salvageLevels(raw);
        if (salvaged) {
          chartCache.set(key, { at: Date.now(), value: salvaged });
          return { ok: true, levels: salvaged };
        }
        lastError = "Связь с ИИ оборвалась на полуслове. Попробуй ещё раз.";
      }
    }
    return { ok: false, error: lastError };
  });

const simpleCache = new Map<string, { at: number; value: string }>();
const SIMPLE_TTL = 180_000;

/** Rephrases an already-generated AI verdict in plain, jargon-free language for a non-trader. */
export const explainSimple = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { base?: string; interval?: string; direction?: string; verdict?: string; reasons?: string[] }) => ({
    base: String(input.base ?? "").toUpperCase(),
    interval: asInterval(input.interval),
    direction: input.direction === "LONG" || input.direction === "SHORT" ? input.direction : "WAIT",
    verdict: String(input.verdict ?? "").slice(0, 400),
    reasons: Array.isArray(input.reasons) ? input.reasons.map((r) => String(r).slice(0, 200)).slice(0, 3) : [],
  }))
  .handler(async ({ data, context }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    if (!data.base || !data.verdict) return { ok: false, error: "Сначала сделай анализ ИИ." };
    const key = `${data.base}:${data.interval}:${data.verdict}`;
    const hit = simpleCache.get(key);
    if (hit && Date.now() - hit.at < SIMPLE_TTL) return { ok: true, text: hit.value };
    if (!allow(context.userId, "chart-ai", 15, 180_000)) {
      return { ok: false, error: "Слишком часто. Подожди немного." };
    }
    const { completeAi } = await import("./ai.server");
    const directionRu = data.direction === "LONG" ? "покупать" : data.direction === "SHORT" ? "продавать" : "подождать";
    const system =
      "Объясни вывод трейдера-аналитика простыми словами человеку, который совсем не разбирается в бирже и первый раз видит такой график. Никаких терминов (RSI, MACD, EMA, support/resistance, лонг/шорт и т.п.) — переведи их смысл на бытовой язык. 2-4 коротких предложения по-русски, как будто объясняешь другу. Без гарантий и инвестиционных советов. Ответь только самим объяснением, без заголовков, без JSON, без markdown.";
    const user = [
      `Монета: ${data.base}.`,
      `Вывод аналитика: ${data.verdict}`,
      data.reasons.length ? `Причины вывода: ${data.reasons.join("; ")}` : "",
      `Рекомендация: ${directionRu}.`,
    ]
      .filter(Boolean)
      .join("\n");

    // A local network proxy occasionally cuts AI responses short mid-sentence —
    // one more try usually gets a complete answer.
    const looksComplete = (t: string) => t.length >= 40 && /[.!?…]["')]?$/.test(t) && /^[А-ЯA-Z]/.test(t);
    let best = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await completeAi({ system, user, json: false, maxTokens: 400, temperature: 0.4 });
      if (!raw) continue;
      const text = raw.trim();
      if (text.length > best.length) best = text;
      if (looksComplete(text)) {
        simpleCache.set(key, { at: Date.now(), value: text });
        return { ok: true, text };
      }
    }
    if (best) {
      simpleCache.set(key, { at: Date.now(), value: best });
      return { ok: true, text: best };
    }
    return { ok: false, error: "ИИ сейчас не ответил. Попробуй ещё раз." };
  });
