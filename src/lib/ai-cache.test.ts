import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { SqlLike } from "./account-store.server.ts";
import { AI_CACHE_TTL, cachedAi, peekAi, peekManyAi, resetAiCache } from "./ai-cache.server.ts";
import { siteAiLimit, siteAiToday, takeSiteAi } from "./billing-store.server.ts";

async function db(): Promise<SqlLike> {
  const pg = new PGlite();
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pg.exec(readFileSync(`migrations/${file}`, "utf8"));
  }
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return (await pg.query(text, values)).rows;
  }) as SqlLike;
}

const answer = (value: string) => async () => ({ ok: true as const, value });

test("a fresh answer is reused, a stale one is asked again", async () => {
  const sql = await db();
  resetAiCache(async () => sql);
  let calls = 0;
  const run = async () => ({ ok: true as const, value: `answer ${++calls}` });
  const t0 = Date.UTC(2026, 8, 28, 12);
  assert.deepEqual(await cachedAi("k", AI_CACHE_TTL, run, t0), { ok: true, value: "answer 1" });
  assert.deepEqual(await cachedAi("k", AI_CACHE_TTL, run, t0 + AI_CACHE_TTL - 1000), { ok: true, value: "answer 1" });
  assert.equal(calls, 1);
  assert.deepEqual(await cachedAi("k", AI_CACHE_TTL, run, t0 + AI_CACHE_TTL + 1000), { ok: true, value: "answer 2" });
  assert.equal(calls, 2);
});

test("the answer survives a restart through the database", async () => {
  const sql = await db();
  resetAiCache(async () => sql);
  const now = Date.now();
  await cachedAi("coin", AI_CACHE_TTL, answer("stored"), now);
  resetAiCache(); // memory gone, same database
  assert.equal(await peekAi<string>("coin", AI_CACHE_TTL, now + 1000), "stored");
  assert.equal(await peekAi<string>("coin", AI_CACHE_TTL, now + AI_CACHE_TTL + 1000), null);
  const long = `simple:${"слово ".repeat(200)}`;
  await cachedAi(long, AI_CACHE_TTL, answer("long key"), now);
  resetAiCache();
  assert.equal(await peekAi<string>(long, AI_CACHE_TTL, now), "long key");
});

test("many people at once cost one request", async () => {
  resetAiCache(async () => db());
  let calls = 0;
  const run = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { ok: true as const, value: "shared" };
  };
  const results = await Promise.all(Array.from({ length: 5 }, () => cachedAi("same", AI_CACHE_TTL, run)));
  assert.equal(calls, 1);
  assert.ok(results.every((r) => r.ok && r.value === "shared"));
});

test("failures are not cached, and a waiter retries on its own", async () => {
  const sql = await db();
  resetAiCache(async () => sql);
  let calls = 0;
  const fail = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { ok: false as const, reason: "limit" };
  };
  const [first, second] = await Promise.all([cachedAi("x", AI_CACHE_TTL, fail), cachedAi("x", AI_CACHE_TTL, answer("mine"))]);
  assert.deepEqual(first, { ok: false, reason: "limit" });
  assert.deepEqual(second, { ok: true, value: "mine" });
  assert.equal(calls, 1);
  assert.equal(await peekAi("x", AI_CACHE_TTL), "mine");
  resetAiCache(async () => sql);
  assert.deepEqual(await cachedAi("y", AI_CACHE_TTL, fail), { ok: false, reason: "limit" });
  assert.equal(await peekAi("y", AI_CACHE_TTL), null);
});

test("the site-wide daily ceiling stops at the limit and gives back failed requests", async () => {
  const sql = await db();
  const now = Date.UTC(2026, 8, 28, 12);
  const a = await takeSiteAi(sql, 2, now);
  const b = await takeSiteAi(sql, 2, now);
  assert.ok(a && b);
  assert.equal(await takeSiteAi(sql, 2, now), null, "third request of the day is refused");
  await b();
  await b(); // giving back twice counts once
  assert.equal(await siteAiToday(sql, now), 1);
  assert.ok(await takeSiteAi(sql, 2, now));
  assert.ok(await takeSiteAi(sql, 2, now + 24 * 3_600_000), "a new day starts from zero");
});

test("AI_DAILY_LIMIT overrides the default", () => {
  const saved = process.env.AI_DAILY_LIMIT;
  delete process.env.AI_DAILY_LIMIT;
  assert.equal(siteAiLimit(), 1500);
  process.env.AI_DAILY_LIMIT = "20";
  assert.equal(siteAiLimit(), 20);
  process.env.AI_DAILY_LIMIT = "nonsense";
  assert.equal(siteAiLimit(), 1500);
  if (saved === undefined) delete process.env.AI_DAILY_LIMIT;
  else process.env.AI_DAILY_LIMIT = saved;
});

test("many answers are read at once, fresh ones only", async () => {
  const sql = await db();
  resetAiCache(async () => sql);
  const now = Date.UTC(2026, 8, 29, 12);
  await cachedAi("chart:paid:BTC", AI_CACHE_TTL, answer("btc"), now);
  await cachedAi("chart:paid:ETH", AI_CACHE_TTL, answer("eth"), now - AI_CACHE_TTL - 1000);
  resetAiCache(); // from the database, not memory
  await cachedAi("chart:free:SOL", AI_CACHE_TTL, answer("sol"), now); // and one from memory
  const found = await peekManyAi<string>(["chart:paid:BTC", "chart:paid:ETH", "chart:free:SOL", "chart:paid:XRP"], AI_CACHE_TTL, now + 1000);
  assert.deepEqual(Object.fromEntries(found), { "chart:free:SOL": "sol", "chart:paid:BTC": "btc" });
});
