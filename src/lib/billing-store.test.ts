import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  claimReferral,
  consumeAi,
  createPayment,
  grantPlan,
  loadPlan,
  markPaid,
  usageToday,
  type SqlLike,
} from "./billing-store.server.ts";

const DAY = 86_400_000;

async function db(): Promise<SqlLike> {
  const pg = new PGlite();
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pg.exec(readFileSync(`migrations/${file}`, "utf8"));
  }
  await pg.query(`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values
    ('u1','a','a@x',false,now(),now()), ('u2','b','b@x',false,now(),now()), ('u3','c','c@x',false,now(),now())`);
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return (await pg.query(text, values)).rows;
  }) as SqlLike;
}

test("new members start with a Pro trial that ends into the free plan", async () => {
  const sql = await db();
  const now = Date.now();
  const first = await loadPlan(sql, "u1", now);
  assert.equal(first.plan, "pro");
  assert.equal(first.trial, true);
  assert.equal((await loadPlan(sql, "u1", now + 4 * DAY)).plan, "free");
  assert.equal(first.refCode.length, 7);
});

test("the daily quota stops at the limit and refunds failed calls", async () => {
  const sql = await db();
  await loadPlan(sql, "u1"); // joins today with a 3-day trial
  const later = Date.now() + 5 * DAY; // trial over -> free plan: 3 analyses a day
  for (let i = 0; i < 3; i += 1)
    assert.equal((await consumeAi(sql, "u1", "analysis", { now: later })).ok, true);
  const blocked = await consumeAi(sql, "u1", "analysis", { now: later });
  assert.deepEqual(blocked, { ok: false, plan: "free", limit: 3 });
  assert.equal(
    (await consumeAi(sql, "u1", "strategy", { now: later })).ok,
    false,
    "strategies are not in the free plan",
  );
  assert.equal((await usageToday(sql, "u1", later)).analysis, 3);
  // A different day starts fresh; a refunded call doesn't count.
  const next = later + DAY;
  const one = await consumeAi(sql, "u1", "analysis", { now: next });
  assert.ok(one.ok);
  if (one.ok) await one.refund();
  assert.equal((await usageToday(sql, "u1", next)).analysis, 0);
  assert.equal((await consumeAi(sql, "u1", "analysis", { now: later, unlimited: true })).ok, true);
});

test("a paid payment grants the plan exactly once, and time stacks", async () => {
  const sql = await db();
  const pay = await createPayment(sql, "u2", "max", "month", "stripe");
  assert.equal(pay.amount, 24);
  assert.equal(await markPaid(sql, pay.id, 10), "amount_mismatch");
  assert.equal(await markPaid(sql, pay.id, 24), "granted");
  assert.equal(await markPaid(sql, pay.id, 24), "already");
  const state = await loadPlan(sql, "u2");
  assert.equal(state.plan, "max");
  assert.equal(state.trial, false);
  const until = state.until!;
  assert.ok(Math.abs(until - (Date.now() + 30 * DAY)) < 60_000);
  const more = await grantPlan(sql, "u2", "max", 30);
  assert.ok(Math.abs(more.until! - (until + 30 * DAY)) < 60_000);
  // Switching to Pro converts the Max time left at its value (24/9 as many days).
  const switched = await grantPlan(sql, "u3", "pro", 30);
  const toMax = await grantPlan(sql, "u3", "max", 30);
  assert.ok(
    Math.abs(toMax.until! - (Date.now() + ((30 * 9) / 24) * DAY + 30 * DAY)) < 60_000,
    String(switched.until),
  );
});

test("referrals extend the friend's trial and reward the inviter once", async () => {
  const sql = await db();
  const inviter = await loadPlan(sql, "u1");
  assert.equal(await claimReferral(sql, "u2", "nope"), "bad_code");
  assert.equal(await claimReferral(sql, "u1", inviter.refCode), "self");
  assert.equal(await claimReferral(sql, "u2", inviter.refCode), "ok");
  assert.equal(await claimReferral(sql, "u2", inviter.refCode), "already");
  const friend = await loadPlan(sql, "u2");
  assert.ok(friend.until! > Date.now() + 6 * DAY, "friend gets 7 days");
  const after = await loadPlan(sql, "u1");
  assert.equal(after.refBonusDays, 3);
  assert.ok(after.until! > inviter.until! + 2 * DAY);
  // Same IP as the inviter: the friend still joins, the inviter earns nothing.
  await sql`insert into "session" (id, "expiresAt", token, "updatedAt", "ipAddress", "userId") values ('s1', now() + interval '1 day', 't1', now(), '1.2.3.4', 'u1')`;
  assert.equal(await claimReferral(sql, "u3", inviter.refCode, { ip: "1.2.3.4" }), "ok_no_bonus");
  assert.equal((await loadPlan(sql, "u1")).refBonusDays, 3);
});
