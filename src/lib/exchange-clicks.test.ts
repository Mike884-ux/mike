import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { SqlLike } from "./account-store.server.ts";
import { clickStats, recordClick } from "./exchange-clicks.server.ts";

async function db(): Promise<SqlLike> {
  const pg = new PGlite();
  for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(`migrations/${file}`, "utf8"));
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return (await pg.query(text, values)).rows;
  }) as SqlLike;
}

test("clicks add up per exchange over today, 7 and 30 days, with top countries", async () => {
  const sql = await db();
  const now = Date.UTC(2026, 8, 29, 12);
  const day = 86_400_000;
  await recordClick(sql, "binance", "TJ", now);
  await recordClick(sql, "binance", "TJ", now);
  await recordClick(sql, "binance", "RU", now - 3 * day);
  await recordClick(sql, "okx", "UZ", now - 20 * day);
  await recordClick(sql, "okx", "UZ", now - 40 * day); // outside the 30 days
  const stats = await clickStats(sql, now);
  assert.deepEqual(stats.rows[0], { exchange: "binance", today: 2, week: 3, month: 3 });
  assert.deepEqual(stats.rows[1], { exchange: "okx", today: 0, week: 0, month: 1 });
  assert.equal(stats.rows.length, 6);
  assert.deepEqual(stats.countries, [{ country: "TJ", count: 2 }, { country: "RU", count: 1 }, { country: "UZ", count: 1 }]);
});
