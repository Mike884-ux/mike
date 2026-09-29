/** Clicks through to the exchanges — **server-only**. */
import type { SqlLike } from "./account-store.server.ts";
import { EXCHANGES, type Exchange } from "./exchanges.ts";

const day = (now: number) => new Date(now).toISOString().slice(0, 10);
const DAY_MS = 86_400_000;

export async function recordClick(sql: SqlLike, exchange: Exchange, country: string, now = Date.now()): Promise<void> {
  await sql`
    insert into exchange_clicks (day, exchange, country, count) values (${day(now)}, ${exchange}, ${country}, 1)
    on conflict (day, exchange, country) do update set count = exchange_clicks.count + 1`;
}

export type ClickStats = {
  rows: { exchange: Exchange; today: number; week: number; month: number }[];
  countries: { country: string; count: number }[];
};

/** Per exchange: today, the last 7 and 30 days (today included); and the top countries over 30 days. */
export async function clickStats(sql: SqlLike, now = Date.now()): Promise<ClickStats> {
  const today = day(now);
  const since7 = day(now - 6 * DAY_MS);
  const since30 = day(now - 29 * DAY_MS);
  const rows = await sql<{ exchange: string; today: number; week: number; month: number }>`
    select exchange,
      coalesce(sum(count) filter (where day = ${today}::date), 0)::int as today,
      coalesce(sum(count) filter (where day >= ${since7}::date), 0)::int as week,
      coalesce(sum(count), 0)::int as month
    from exchange_clicks where day >= ${since30}::date group by exchange`;
  const countries = await sql<{ country: string; count: number }>`
    select country, sum(count)::int as count from exchange_clicks
    where day >= ${since30}::date group by country order by count desc, country limit 5`;
  const by = new Map(rows.map((r) => [r.exchange, r]));
  return {
    rows: EXCHANGES.map((exchange) => {
      const r = by.get(exchange);
      return { exchange, today: Number(r?.today ?? 0), week: Number(r?.week ?? 0), month: Number(r?.month ?? 0) };
    }).sort((a, b) => b.month - a.month),
    countries: countries.map((c) => ({ country: c.country, count: Number(c.count) })),
  };
}
