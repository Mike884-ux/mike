/**
 * Alerts, Telegram links and saved screens — **server-only** data access.
 * Free of app imports so unit tests can run it against an in-memory PGLite.
 * Callers pass verified user ids.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { alertValue, kindAllowed, type Alert, type AlertKind } from "./alert-rules.ts";
import type { SqlLike } from "./billing-store.server.ts";
import { ALERT_LIMITS, SAVED_SCREEN_LIMITS, type PlanId } from "./plans.ts";
import type { ScreenFilters } from "./screener.ts";

export const LINK_CODE_TTL_MS = 15 * 60_000;

type AlertRow = {
  id: string;
  symbol: string;
  coin_id: string | null;
  kind: string;
  value: number | null;
  state: string | null;
  active: boolean;
  fired_count: number;
  last_fired_at: unknown;
  created_at: unknown;
};

const ms = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const t = new Date(value as string | Date).getTime();
  return Number.isFinite(t) ? t : null;
};

function toAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    symbol: row.symbol,
    coinId: row.coin_id,
    kind: row.kind as AlertKind,
    value: row.value === null ? null : Number(row.value),
    state: row.state,
    active: Boolean(row.active),
    firedCount: Number(row.fired_count) || 0,
    lastFiredAt: ms(row.last_fired_at),
    createdAt: ms(row.created_at) ?? 0,
  };
}

export async function listAlerts(sql: SqlLike, userId: string): Promise<Alert[]> {
  const rows = await sql<AlertRow>`
    select id, symbol, coin_id, kind, value, state, active, fired_count, last_fired_at, created_at
    from alerts where user_id = ${userId} order by created_at desc`;
  return rows.map(toAlert);
}

export type CreateAlertResult =
  | { ok: true; alert: Alert }
  | { ok: false; error: "pro" | "limit" | "bad_input"; limit?: number };

export async function createAlert(
  sql: SqlLike,
  userId: string,
  plan: PlanId,
  input: { symbol: string; coinId: string | null; kind: AlertKind; value: unknown },
): Promise<CreateAlertResult> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,15}$/.test(symbol)) return { ok: false, error: "bad_input" };
  const value = alertValue(input.kind, input.value);
  if (value === undefined) return { ok: false, error: "bad_input" };
  if (!kindAllowed(plan, input.kind)) return { ok: false, error: "pro" };
  const limit = ALERT_LIMITS[plan];
  const id = randomUUID();
  // The count and the insert are one statement, so parallel requests can't overshoot.
  const rows = await sql<AlertRow>`
    insert into alerts (id, user_id, symbol, coin_id, kind, value)
    select ${id}, ${userId}, ${symbol}, ${input.coinId}, ${input.kind}, ${value}
    where (select count(*) from alerts where user_id = ${userId} and active) < ${limit}
    returning id, symbol, coin_id, kind, value, state, active, fired_count, last_fired_at, created_at`;
  if (!rows[0]) return { ok: false, error: "limit", limit };
  return { ok: true, alert: toAlert(rows[0]) };
}

export async function deleteAlert(sql: SqlLike, userId: string, id: string): Promise<boolean> {
  const rows = await sql<{ id: string }>`delete from alerts where id = ${id} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

export type DueAlert = Alert & { userId: string; chatId: string; lang: string };

/** Active alerts of members who linked Telegram — the only ones there is somewhere to send. */
export async function activeAlerts(sql: SqlLike): Promise<DueAlert[]> {
  const rows = await sql<AlertRow & { user_id: string; chat_id: string | number; lang: string | null }>`
    select a.id, a.symbol, a.coin_id, a.kind, a.value, a.state, a.active, a.fired_count, a.last_fired_at, a.created_at,
      a.user_id, t.chat_id, s.lang
    from alerts a
    join telegram_links t on t.user_id = a.user_id
    left join user_settings s on s.user_id = a.user_id
    where a.active
    order by a.created_at asc`;
  return rows.map((row) => ({ ...toAlert(row), userId: row.user_id, chatId: String(row.chat_id), lang: row.lang ?? "ru" }));
}

/** Remembers the new state; a fire bumps the counter and may switch the alert off. */
export async function saveVerdict(
  sql: SqlLike,
  id: string,
  verdict: { fire: boolean; state: string | null; deactivate: boolean },
  now = Date.now(),
): Promise<void> {
  if (verdict.fire) {
    await sql`update alerts set state = ${verdict.state}, active = ${!verdict.deactivate},
      fired_count = fired_count + 1, last_fired_at = ${new Date(now)} where id = ${id}`;
  } else {
    await sql`update alerts set state = ${verdict.state} where id = ${id} and state is distinct from ${verdict.state}`;
  }
}

/* ------------------------------------------------------------------ Telegram links */

export async function createLinkCode(sql: SqlLike, userId: string, now = Date.now()): Promise<string> {
  const code = randomBytes(12).toString("base64url");
  await sql`delete from telegram_link_codes where user_id = ${userId} or expires_at < ${new Date(now)}`;
  await sql`insert into telegram_link_codes (code, user_id, expires_at) values (${code}, ${userId}, ${new Date(now + LINK_CODE_TTL_MS)})`;
  return code;
}

/** Links the chat to the code's owner. The code works once; a chat belongs to one account. */
export async function claimLinkCode(
  sql: SqlLike,
  code: string,
  chatId: string,
  username: string | null,
  now = Date.now(),
): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) return null;
  const [row] = await sql<{ user_id: string }>`
    delete from telegram_link_codes where code = ${code} and expires_at > ${new Date(now)} returning user_id`;
  if (!row) return null;
  await sql`delete from telegram_links where chat_id = ${chatId} and user_id <> ${row.user_id}`;
  await sql`
    insert into telegram_links (user_id, chat_id, username, linked_at) values (${row.user_id}, ${chatId}, ${username}, ${new Date(now)})
    on conflict (user_id) do update set chat_id = excluded.chat_id, username = excluded.username, linked_at = excluded.linked_at`;
  return row.user_id;
}

export async function telegramLink(sql: SqlLike, userId: string): Promise<{ username: string | null; linkedAt: number } | null> {
  const [row] = await sql<{ username: string | null; linked_at: unknown }>`
    select username, linked_at from telegram_links where user_id = ${userId}`;
  return row ? { username: row.username, linkedAt: ms(row.linked_at) ?? 0 } : null;
}

export async function userByChat(sql: SqlLike, chatId: string): Promise<string | null> {
  const [row] = await sql<{ user_id: string }>`select user_id from telegram_links where chat_id = ${chatId}`;
  return row?.user_id ?? null;
}

export async function unlinkUser(sql: SqlLike, userId: string): Promise<void> {
  await sql`delete from telegram_links where user_id = ${userId}`;
}

export async function unlinkChat(sql: SqlLike, chatId: string): Promise<boolean> {
  const rows = await sql<{ user_id: string }>`delete from telegram_links where chat_id = ${chatId} returning user_id`;
  return rows.length > 0;
}

/* ------------------------------------------------------------------ saved screens */

export type SavedScreen = { id: string; name: string; filters: ScreenFilters; createdAt: number };

export async function listScreens(sql: SqlLike, userId: string): Promise<SavedScreen[]> {
  const rows = await sql<{ id: string; name: string; filters: unknown; created_at: unknown }>`
    select id, name, filters, created_at from saved_screens where user_id = ${userId} order by created_at desc`;
  return rows.map((r) => ({ id: r.id, name: r.name, filters: (typeof r.filters === "string" ? JSON.parse(r.filters) : r.filters) as ScreenFilters, createdAt: ms(r.created_at) ?? 0 }));
}

export async function saveScreen(
  sql: SqlLike,
  userId: string,
  plan: PlanId,
  name: string,
  filters: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: "pro" | "limit" | "bad_input" }> {
  const limit = SAVED_SCREEN_LIMITS[plan];
  if (limit <= 0) return { ok: false, error: "pro" };
  const clean = name.trim().slice(0, 60);
  const json = JSON.stringify(filters ?? {});
  if (!clean || json.length > 2000) return { ok: false, error: "bad_input" };
  const id = randomUUID();
  const rows = await sql<{ id: string }>`
    insert into saved_screens (id, user_id, name, filters)
    select ${id}, ${userId}, ${clean}, ${json}::jsonb
    where (select count(*) from saved_screens where user_id = ${userId}) < ${limit}
    returning id`;
  return rows[0] ? { ok: true, id } : { ok: false, error: "limit" };
}

export async function deleteScreen(sql: SqlLike, userId: string, id: string): Promise<void> {
  await sql`delete from saved_screens where id = ${id} and user_id = ${userId}`;
}
