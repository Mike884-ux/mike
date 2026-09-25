import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { importPositions, loadAccount, removePosition, saveSettings, trade, type SqlLike } from "./account-store.server.ts";

async function db(): Promise<SqlLike> {
  const pg = new PGlite();
  for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(`migrations/${file}`, "utf8"));
  }
  await pg.query(`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ('u1','a','a@x',false,now(),now()), ('u2','b','b@x',false,now(),now())`);
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return (await pg.query(text, values)).rows;
  }) as SqlLike;
  return sql;
}

const btc = { base: "BTC", symbol: "BTCUSDT" };

test("buys average in, sells book profit and close the position", async () => {
  const sql = await db();
  assert.deepEqual(await trade(sql, "u1", { ...btc, side: "buy", qty: 1, price: 100 }), { ok: true, realizedPnl: null });
  await trade(sql, "u1", { ...btc, side: "buy", qty: 1, price: 200 });
  let acc = await loadAccount(sql, "u1");
  assert.equal(acc.positions.length, 1);
  assert.equal(acc.positions[0]!.qty, 2);
  assert.equal(acc.positions[0]!.entry, 150);

  assert.deepEqual(await trade(sql, "u1", { ...btc, side: "sell", qty: 0.5, price: 250 }), { ok: true, realizedPnl: 50 });
  assert.deepEqual(await trade(sql, "u1", { ...btc, side: "sell", qty: 5, price: 250 }), { ok: false, error: "not_enough" });
  await trade(sql, "u1", { ...btc, side: "sell", qty: 1.5, price: 100 });
  acc = await loadAccount(sql, "u1");
  assert.equal(acc.positions.length, 0);
  assert.equal(acc.transactions.length, 4);
  assert.equal(acc.transactions[0]!.side, "sell");
  assert.equal(acc.transactions[0]!.realizedPnl, -75);
});

test("users never see each other's data", async () => {
  const sql = await db();
  await trade(sql, "u1", { ...btc, side: "buy", qty: 1, price: 100 });
  const other = await loadAccount(sql, "u2");
  assert.equal(other.positions.length, 0);
  assert.equal(other.transactions.length, 0);
  const mine = await loadAccount(sql, "u1");
  assert.equal(await removePosition(sql, "u2", mine.positions[0]!.id), false);
  assert.deepEqual(await trade(sql, "u2", { ...btc, side: "sell", qty: 1, price: 100 }), { ok: false, error: "no_position" });
});

test("settings save and merge; bad trades are rejected", async () => {
  const sql = await db();
  await saveSettings(sql, "u1", { lang: "en" });
  await saveSettings(sql, "u1", { favorites: ["BTC", "ETH"] });
  const { settings } = await loadAccount(sql, "u1");
  assert.deepEqual(settings, { lang: "en", country: "OTHER", favorites: ["BTC", "ETH"] });
  assert.deepEqual(await trade(sql, "u1", { ...btc, side: "buy", qty: 0, price: 1 }), { ok: false, error: "bad_input" });
  assert.deepEqual(await trade(sql, "u1", { ...btc, side: "buy", qty: 1, price: Number.NaN }), { ok: false, error: "bad_input" });
});

test("browser wallet imports once", async () => {
  const sql = await db();
  const local = [{ ...btc, qty: 2, entry: 50 }, { base: "ETH", symbol: "ETHUSDT", qty: 1, entry: 10 }];
  assert.equal(await importPositions(sql, "u1", local), 2);
  assert.equal(await importPositions(sql, "u1", local), 0);
  assert.equal((await loadAccount(sql, "u1")).positions.length, 2);
});
