/**
 * The alert checker behind /api/cron/alerts and the Telegram bot's replies —
 * **server-only**. Prices come from the market listing, signal and RSI from
 * the shared scan.
 */
import { evaluate, FREE_KINDS, type Quote, type Tech } from "./alert-rules.ts";
import type { MarketCoin } from "./coins";
import { ALERT_LIMITS, type PlanId } from "./plans.ts";
import type { CoinRow } from "./scan";

const PLAN_ORDER: Record<PlanId, number> = { max: 0, pro: 1, free: 2 };

export type RunResult = { checked: number; fired: number; sent: number; failed: number };

export function quoteOf(coin: MarketCoin | undefined): Quote | null {
  return coin && coin.price > 0 ? { price: coin.price, change24h: coin.change24h } : null;
}

export function techMap(rows: CoinRow[] | null | undefined): Map<string, Tech> {
  const map = new Map<string, Tech>();
  for (const row of rows ?? []) if (row.kind === "crypto") map.set(row.base, { signal: row.signal, rsi: row.rsi });
  return map;
}

/** Market rows for the given tickers, fetched in chunks the upstream accepts. */
export async function coinsBySymbol(symbols: string[]): Promise<MarketCoin[]> {
  const { getBySymbols } = await import("./coins.server");
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const out: MarketCoin[] = [];
  for (let i = 0; i < unique.length; i += 50) {
    const listing = await getBySymbols(unique.slice(i, i + 50));
    out.push(...(listing?.coins ?? []));
  }
  return out;
}

export async function runAlerts(origin: string, now = Date.now()): Promise<RunResult> {
  const [{ getSql }, store, billing, tg, { runScan }] = await Promise.all([
    import("./db"),
    import("./alerts-store.server"),
    import("./billing-store.server"),
    import("./telegram.server"),
    import("./scan.server"),
  ]);
  const sql = await getSql();
  const all = await store.activeAlerts(sql);
  const result: RunResult = { checked: 0, fired: 0, sent: 0, failed: 0 };
  if (!all.length) return result;

  // Each member's plan decides which of their alerts still run (a trial may have ended).
  const plans = new Map<string, PlanId>();
  const { isAdminEmail } = await import("./quota.server");
  const emails = await sql<{ id: string; email: string }>`select id, email from "user" where id = any(${[...new Set(all.map((a) => a.userId))]})`;
  const emailOf = new Map(emails.map((r) => [r.id, r.email]));
  for (const userId of new Set(all.map((a) => a.userId))) {
    const state = await billing.loadPlan(sql, userId, now);
    plans.set(userId, isAdminEmail(emailOf.get(userId) ?? "") ? "max" : state.plan);
  }
  const perUser = new Map<string, number>();
  const runnable = all
    .filter((alert) => {
      const plan = plans.get(alert.userId) ?? "free";
      if (plan === "free" && !FREE_KINDS.includes(alert.kind)) return false;
      const n = (perUser.get(alert.userId) ?? 0) + 1;
      perUser.set(alert.userId, n);
      return n <= ALERT_LIMITS[plan];
    })
    // Whale first, then Pro: their messages go out before the free ones.
    .sort((a, b) => PLAN_ORDER[plans.get(a.userId) ?? "free"] - PLAN_ORDER[plans.get(b.userId) ?? "free"]);

  const coins = await coinsBySymbol(runnable.map((a) => a.symbol));
  const byId = new Map(coins.map((c) => [c.id, c]));
  const bySymbol = new Map<string, MarketCoin>();
  for (const c of coins) if (!bySymbol.has(c.symbol.toUpperCase())) bySymbol.set(c.symbol.toUpperCase(), c);
  const needsTech = runnable.some((a) => a.kind === "signal" || a.kind === "rsi_below" || a.kind === "rsi_above");
  const tech = needsTech ? techMap(await runScan("1h").catch(() => [])) : new Map<string, Tech>();

  for (const alert of runnable) {
    result.checked += 1;
    const coin = (alert.coinId ? byId.get(alert.coinId) : undefined) ?? bySymbol.get(alert.symbol);
    const quote = quoteOf(coin);
    const t = tech.get(alert.symbol) ?? null;
    const verdict = evaluate(alert, quote, t);
    if (!verdict) continue;
    if (!verdict.fire) {
      await store.saveVerdict(sql, alert.id, verdict, now);
      continue;
    }
    result.fired += 1;
    const lang = tg.botLang(alert.lang);
    const url = coin ? `${origin}/coins/${coin.id}` : null;
    try {
      await tg.sendMessage(alert.chatId, tg.alertMessage(lang, alert, quote, t, url));
      result.sent += 1;
      await store.saveVerdict(sql, alert.id, verdict, now);
    } catch (err) {
      result.failed += 1;
      // 403: the member blocked the bot — stop trying that chat. Anything else is retried next round.
      if (err instanceof tg.TelegramError && err.status === 403) await store.unlinkChat(sql, alert.chatId);
      else console.error("[alerts] send failed:", err instanceof Error ? err.message : err);
    }
  }
  return result;
}
