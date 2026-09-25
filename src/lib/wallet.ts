import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { allow } from "./rate-limit";
import type { Ticker } from "./types";

export const getPrices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { symbols?: string[] }) => ({
    symbols: (input.symbols ?? []).slice(0, 30).map((s) => String(s)),
  }))
  .handler(async ({ data }): Promise<Ticker[]> => {
    if (!data.symbols.length) return [];
    const marketMod = await import("./market.server");
    return marketMod.fetchTickers(data.symbols);
  });

export type WalletPositionInput = {
  base: string;
  qty: number;
  entry: number;
  price: number;
  pnlPct: number;
  daysHeld: number | null;
};

export const getWalletAdvice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { positions?: WalletPositionInput[]; totalPnlPct?: number }) => ({
    positions: (input.positions ?? []).slice(0, 30),
    totalPnlPct: Number(input.totalPnlPct ?? 0),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    if (!data.positions.length) return { ok: false, error: "Кошелёк пуст." };
    if (!allow(context.userId, "wallet-advice", 10, 180_000)) {
      return { ok: false, error: "Слишком часто. Подожди немного." };
    }
    const { completeAi } = await import("./ai.server");
    const lines = data.positions.map(
      (p) =>
        `${p.base}: кол-во ${p.qty}, вход ${p.entry}, сейчас ${p.price}, P/L ${p.pnlPct.toFixed(1)}%, в позиции ${
          p.daysHeld ?? "?"
        } дн.`,
    );
    const raw = await completeAi({
      system:
        "Ты аналитик, который кратко разбирает портфель пользователя. Русский язык, без markdown, 3-5 предложений. Отметь какие позиции в минусе и сколько дней уже, где риск выше, дай общий вывод по портфелю. Без гарантий и инвестиционных советов, это не финансовая рекомендация.",
      user: [
        `Портфель (${data.positions.length} позиций), общий P/L ${data.totalPnlPct.toFixed(1)}%:`,
        ...lines,
        "Разбери портфель: что в минусе и как долго, что делать осторожнее, общий вывод.",
      ].join("\n"),
      maxTokens: 700,
      temperature: 0.3,
    });
    if (!raw) return { ok: false, error: "ИИ сейчас не ответил. Попробуй ещё раз." };
    const clean = raw
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .trim();
    return { ok: true, text: clean };
  });

export const PORTFOLIO_PERIODS = [
  { id: "1d", label: "1д" },
  { id: "10d", label: "10д" },
  { id: "20d", label: "20д" },
  { id: "30d", label: "30д" },
  { id: "1y", label: "1г" },
] as const;
export type PortfolioPeriod = (typeof PORTFOLIO_PERIODS)[number]["id"];

const PERIOD_SPEC: Record<PortfolioPeriod, { interval: string; limit: number }> = {
  "1d": { interval: "1h", limit: 24 },
  "10d": { interval: "1d", limit: 10 },
  "20d": { interval: "1d", limit: 20 },
  "30d": { interval: "1d", limit: 30 },
  "1y": { interval: "1d", limit: 365 },
};

export type PortfolioPoint = { t: number; value: number };

/**
 * Value of the wallet's CURRENT holdings priced at each historical point — not
 * a record of what was actually owned back then. Simple, and what people expect
 * from a "how has my portfolio moved" chart: current qty × historical close.
 */
export const getPortfolioHistory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { positions?: { symbol?: string; qty?: number }[]; period?: string }) => ({
    positions: (input.positions ?? [])
      .map((p) => ({ symbol: String(p.symbol ?? ""), qty: Number(p.qty ?? 0) }))
      .filter((p) => p.symbol && p.qty > 0)
      .slice(0, 30),
    period: (PORTFOLIO_PERIODS.some((p) => p.id === input.period) ? input.period : "30d") as PortfolioPeriod,
  }))
  .handler(async ({ data }): Promise<PortfolioPoint[]> => {
    if (!data.positions.length) return [];
    const marketMod = await import("./market.server");
    const { interval, limit } = PERIOD_SPEC[data.period];
    const candleLists = await Promise.all(data.positions.map((p) => marketMod.fetchKlines(p.symbol, interval, limit)));
    const byTime = new Map<number, number>();
    data.positions.forEach((p, i) => {
      for (const candle of candleLists[i] ?? []) {
        byTime.set(candle.t, (byTime.get(candle.t) ?? 0) + candle.c * p.qty);
      }
    });
    return [...byTime.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, value]) => ({ t, value: Number(value.toFixed(2)) }));
  });
