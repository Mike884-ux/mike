import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { evaluate, kindAllowed } from "./alert-rules.ts";
import {
  activeAlerts,
  claimLinkCode,
  createAlert,
  createLinkCode,
  deleteAlert,
  LINK_CODE_TTL_MS,
  listAlerts,
  listScreens,
  saveScreen,
  saveVerdict,
  telegramLink,
  unlinkChat,
  userByChat,
} from "./alerts-store.server.ts";
import type { SqlLike } from "./billing-store.server.ts";
import { ALERT_LIMITS } from "./plans.ts";

async function db(): Promise<SqlLike> {
  const pg = new PGlite();
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pg.exec(readFileSync(`migrations/${file}`, "utf8"));
  }
  await pg.query(`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values
    ('u1','a','a@x',false,now(),now()), ('u2','b','b@x',false,now(),now())`);
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return (await pg.query(text, values)).rows;
  }) as SqlLike;
}

test("price alerts fire once and switch off", () => {
  const above = { kind: "price_above" as const, value: 100, state: null };
  assert.deepEqual(evaluate(above, { price: 99, change24h: 1 }, null), { fire: false, state: null, deactivate: false });
  assert.deepEqual(evaluate(above, { price: 101, change24h: 1 }, null), { fire: true, state: null, deactivate: true });
  assert.equal(evaluate(above, null, null), null, "no quote: leave it alone");
  const below = { kind: "price_below" as const, value: 50, state: null };
  assert.equal(evaluate(below, { price: 49.9, change24h: null }, null)?.fire, true);
});

test("signal alerts fire on a change to buy or sell, not on the first look", () => {
  const first = evaluate({ kind: "signal", value: null, state: null }, null, { signal: "LONG", rsi: 50 });
  assert.deepEqual(first, { fire: false, state: "LONG", deactivate: false });
  assert.equal(evaluate({ kind: "signal", value: null, state: "LONG" }, null, { signal: "LONG", rsi: 50 })?.fire, false);
  assert.equal(evaluate({ kind: "signal", value: null, state: "LONG" }, null, { signal: "WAIT", rsi: 50 })?.fire, false);
  assert.equal(evaluate({ kind: "signal", value: null, state: "WAIT" }, null, { signal: "SHORT", rsi: 50 })?.fire, true);
});

test("RSI and big-move alerts don't flap around the threshold", () => {
  const tech = (rsi: number) => ({ signal: "WAIT" as const, rsi });
  let state: string | null = null;
  const step = (rsi: number) => {
    const v = evaluate({ kind: "rsi_below", value: 30, state }, null, tech(rsi))!;
    state = v.state;
    return v.fire;
  };
  assert.equal(step(29), true);
  assert.equal(step(31), false, "still near the zone");
  assert.equal(step(29.5), false, "no second message");
  assert.equal(step(34), false, "left the zone for good");
  assert.equal(step(28), true, "back in: fires again");

  const move = (change: number, s: string | null) => evaluate({ kind: "change_24h", value: 10, state: s }, { price: 1, change24h: change }, null)!;
  assert.equal(move(-12, null).fire, true);
  assert.equal(move(9, "hit").fire, false);
  assert.equal(move(9, "hit").state, "hit");
  assert.equal(move(7, "hit").state, "clear");
});

test("free members get price alerts only, up to the plan limit", async () => {
  const sql = await db();
  assert.equal(kindAllowed("free", "signal"), false);
  assert.deepEqual(await createAlert(sql, "u1", "free", { symbol: "btc", coinId: "bitcoin", kind: "signal", value: null }), { ok: false, error: "pro" });
  for (let i = 0; i < ALERT_LIMITS.free; i += 1) {
    const r = await createAlert(sql, "u1", "free", { symbol: "BTC", coinId: "bitcoin", kind: "price_above", value: 100_000 + i });
    assert.ok(r.ok);
  }
  const over = await createAlert(sql, "u1", "free", { symbol: "BTC", coinId: "bitcoin", kind: "price_below", value: 50_000 });
  assert.deepEqual(over, { ok: false, error: "limit", limit: ALERT_LIMITS.free });
  assert.deepEqual(await createAlert(sql, "u2", "pro", { symbol: "BTC", coinId: null, kind: "price_above", value: -1 }), { ok: false, error: "bad_input" });
  const list = await listAlerts(sql, "u1");
  assert.equal(list.length, 2);
  assert.equal(await deleteAlert(sql, "u2", list[0]!.id), false, "someone else's alert stays");
  assert.equal(await deleteAlert(sql, "u1", list[0]!.id), true);
});

test("link codes work once, expire, and a chat belongs to one account", async () => {
  const sql = await db();
  const now = Date.now();
  const code = await createLinkCode(sql, "u1", now);
  assert.equal(await claimLinkCode(sql, code, "555", "alice", now + LINK_CODE_TTL_MS + 1), null, "expired");
  const fresh = await createLinkCode(sql, "u1", now);
  assert.equal(await claimLinkCode(sql, fresh, "555", "alice", now), "u1");
  assert.equal(await claimLinkCode(sql, fresh, "555", "alice", now), null, "used");
  assert.equal((await telegramLink(sql, "u1"))?.username, "alice");
  const other = await createLinkCode(sql, "u2", now);
  assert.equal(await claimLinkCode(sql, other, "555", "alice", now), "u2");
  assert.equal(await telegramLink(sql, "u1"), null, "the chat moved to the new account");
  assert.equal(await userByChat(sql, "555"), "u2");
  assert.equal(await unlinkChat(sql, "555"), true);
  assert.equal(await userByChat(sql, "555"), null);
});

test("only members with Telegram are checked; a fired price alert goes quiet", async () => {
  const sql = await db();
  const a = await createAlert(sql, "u1", "pro", { symbol: "ETH", coinId: "ethereum", kind: "price_above", value: 10 });
  await createAlert(sql, "u2", "pro", { symbol: "ETH", coinId: "ethereum", kind: "price_above", value: 10 });
  assert.ok(a.ok);
  const code = await createLinkCode(sql, "u1");
  await claimLinkCode(sql, code, "42", null);
  const due = await activeAlerts(sql);
  assert.equal(due.length, 1);
  assert.equal(due[0]!.chatId, "42");
  assert.equal(due[0]!.lang, "ru");
  await saveVerdict(sql, due[0]!.id, { fire: true, state: null, deactivate: true });
  assert.equal((await activeAlerts(sql)).length, 0);
  const [stored] = await listAlerts(sql, "u1");
  assert.equal(stored!.firedCount, 1);
  assert.equal(stored!.active, false);
  assert.ok(stored!.lastFiredAt);
});

test("saved screens are a Pro feature with a limit", async () => {
  const sql = await db();
  assert.deepEqual(await saveScreen(sql, "u1", "free", "x", {}), { ok: false, error: "pro" });
  const saved = await saveScreen(sql, "u1", "pro", "Мой фильтр", { change24h: { min: 5 } });
  assert.ok(saved.ok);
  const list = await listScreens(sql, "u1");
  assert.equal(list[0]!.name, "Мой фильтр");
  assert.deepEqual(list[0]!.filters, { change24h: { min: 5 } });
});
