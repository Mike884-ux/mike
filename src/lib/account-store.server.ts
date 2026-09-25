/**
 * Account data access — **server-only**, and free of app imports so the unit
 * tests can run it against an in-memory PGLite. Callers must pass a verified
 * user id and an already-validated asset (base + symbol from `markets.ts`).
 */
import { randomUUID } from "node:crypto";

export interface SqlLike {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
}

export type Settings = { lang: string; country: string; favorites: string[] };
export type WalletPosition = { id: string; base: string; symbol: string; qty: number; entry: number; openedAt: number };
export type WalletTransaction = {
  id: string;
  side: "buy" | "sell";
  base: string;
  symbol: string;
  qty: number;
  price: number;
  realizedPnl: number | null;
  note: string | null;
  at: number;
};
export type Account = { settings: Settings; positions: WalletPosition[]; transactions: WalletTransaction[] };

export const MAX_POSITIONS = 60;
const EPSILON = 1e-9;

const ms = (value: unknown) => {
  const t = new Date(value as string | Date).getTime();
  return Number.isFinite(t) ? t : 0;
};

function asFavorites(value: unknown): string[] {
  const list = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  return Array.isArray(list) ? list.map(String).slice(0, 200) : [];
}

export async function loadAccount(sql: SqlLike, userId: string): Promise<Account> {
  const [settingsRows, positionRows, txRows] = await Promise.all([
    sql<{ lang: string; country: string; favorites: unknown }>`
      select lang, country, favorites from user_settings where user_id = ${userId}`,
    sql<{ id: string; base: string; symbol: string; qty: number; entry: number; opened_at: unknown }>`
      select id, base, symbol, qty, entry, opened_at from wallet_positions
      where user_id = ${userId} order by opened_at asc`,
    sql<{
      id: string;
      side: "buy" | "sell";
      base: string;
      symbol: string;
      qty: number;
      price: number;
      realized_pnl: number | null;
      note: string | null;
      at: unknown;
    }>`
      select id, side, base, symbol, qty, price, realized_pnl, note, at from wallet_transactions
      where user_id = ${userId} order by at desc limit 300`,
  ]);
  const s = settingsRows[0];
  return {
    settings: s
      ? { lang: s.lang, country: s.country, favorites: asFavorites(s.favorites) }
      : { lang: "", country: "", favorites: [] },
    positions: positionRows.map((r) => ({
      id: r.id,
      base: r.base,
      symbol: r.symbol,
      qty: Number(r.qty),
      entry: Number(r.entry),
      openedAt: ms(r.opened_at),
    })),
    transactions: txRows.map((r) => ({
      id: r.id,
      side: r.side,
      base: r.base,
      symbol: r.symbol,
      qty: Number(r.qty),
      price: Number(r.price),
      realizedPnl: r.realized_pnl === null ? null : Number(r.realized_pnl),
      note: r.note,
      at: ms(r.at),
    })),
  };
}

export async function saveSettings(sql: SqlLike, userId: string, patch: Partial<Settings>): Promise<void> {
  const current = (await loadAccount(sql, userId)).settings;
  const next = {
    lang: patch.lang ?? (current.lang || "ru"),
    country: patch.country ?? (current.country || "OTHER"),
    favorites: patch.favorites ?? current.favorites,
  };
  await sql`
    insert into user_settings (user_id, lang, country, favorites, updated_at)
    values (${userId}, ${next.lang}, ${next.country}, ${JSON.stringify(next.favorites)}::jsonb, now())
    on conflict (user_id) do update
      set lang = excluded.lang, country = excluded.country, favorites = excluded.favorites, updated_at = now()`;
}

export type TradeInput = { side: "buy" | "sell"; base: string; symbol: string; qty: number; price: number; note?: string };
export type TradeResult =
  | { ok: true; realizedPnl: number | null }
  | { ok: false; error: "bad_input" | "no_position" | "not_enough" | "full" };

/**
 * Record a buy or a sell. Buys add to the holding at a weighted-average entry;
 * sells reduce it and book realized profit against that average. Every trade
 * lands in the transaction history.
 */
export async function trade(sql: SqlLike, userId: string, input: TradeInput): Promise<TradeResult> {
  const { side, base, symbol, qty, price } = input;
  if (!(qty > 0) || !(price > 0) || !Number.isFinite(qty) || !Number.isFinite(price)) {
    return { ok: false, error: "bad_input" };
  }
  const note = input.note?.trim().slice(0, 200) || null;
  const rows = await sql<{ id: string; qty: number; entry: number }>`
    select id, qty, entry from wallet_positions where user_id = ${userId} and symbol = ${symbol}`;
  const pos = rows[0];
  let realized: number | null = null;

  if (side === "buy") {
    if (pos) {
      const newQty = Number(pos.qty) + qty;
      const newEntry = (Number(pos.qty) * Number(pos.entry) + qty * price) / newQty;
      await sql`update wallet_positions set qty = ${newQty}, entry = ${newEntry} where id = ${pos.id} and user_id = ${userId}`;
    } else {
      const count = await sql<{ n: number }>`select count(*)::int as n from wallet_positions where user_id = ${userId}`;
      if (Number(count[0]?.n ?? 0) >= MAX_POSITIONS) return { ok: false, error: "full" };
      await sql`
        insert into wallet_positions (id, user_id, base, symbol, qty, entry)
        values (${randomUUID()}, ${userId}, ${base}, ${symbol}, ${qty}, ${price})`;
    }
  } else {
    if (!pos) return { ok: false, error: "no_position" };
    const held = Number(pos.qty);
    if (qty > held + EPSILON) return { ok: false, error: "not_enough" };
    realized = Number(((price - Number(pos.entry)) * qty).toFixed(8));
    const left = held - qty;
    if (left <= EPSILON * Math.max(1, held)) {
      await sql`delete from wallet_positions where id = ${pos.id} and user_id = ${userId}`;
    } else {
      await sql`update wallet_positions set qty = ${left} where id = ${pos.id} and user_id = ${userId}`;
    }
  }

  await sql`
    insert into wallet_transactions (id, user_id, side, base, symbol, qty, price, realized_pnl, note)
    values (${randomUUID()}, ${userId}, ${side}, ${base}, ${symbol}, ${qty}, ${price}, ${realized}, ${note})`;
  return { ok: true, realizedPnl: realized };
}

export async function removePosition(sql: SqlLike, userId: string, id: string): Promise<boolean> {
  const rows = await sql<{ id: string }>`
    delete from wallet_positions where id = ${id} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

/**
 * One-time move of a wallet that used to live only in this browser. Runs only
 * when the account has no positions yet, so it can't double anything.
 */
export async function importPositions(
  sql: SqlLike,
  userId: string,
  positions: { base: string; symbol: string; qty: number; entry: number }[],
): Promise<number> {
  const existing = await sql<{ n: number }>`select count(*)::int as n from wallet_positions where user_id = ${userId}`;
  if (Number(existing[0]?.n ?? 0) > 0) return 0;
  let imported = 0;
  for (const p of positions.slice(0, MAX_POSITIONS)) {
    const result = await trade(sql, userId, { side: "buy", base: p.base, symbol: p.symbol, qty: p.qty, price: p.entry, note: "import" });
    if (result.ok) imported += 1;
  }
  return imported;
}
