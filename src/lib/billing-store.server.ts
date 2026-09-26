/**
 * Plans, AI quotas, referrals and payments — **server-only** data access.
 * Free of app imports (like account-store) so unit tests can run it against an
 * in-memory PGLite. Callers pass verified user ids.
 */
import { randomBytes, randomUUID } from "node:crypto";
import {
  AI_KINDS,
  PERIOD_DAYS,
  PLANS,
  REFERRAL_BONUS_CAP,
  REFERRAL_BONUS_DAYS,
  REFERRED_TRIAL_DAYS,
  TRIAL_DAYS,
  priceOf,
  type AiKind,
  type PaidPlan,
  type Period,
  type PlanId,
} from "./plans.ts";

export interface SqlLike {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
}

type PlanRow = {
  user_id: string;
  plan: string;
  plan_until: unknown;
  trial_until: unknown;
  ref_code: string;
  referred_by: string | null;
  ref_bonus_days: number;
};

export type PlanState = {
  plan: PlanId;
  until: number | null;
  trial: boolean;
  refCode: string;
  referredBy: string | null;
  refBonusDays: number;
};

const DAY_MS = 86_400_000;
const ms = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const t = new Date(value as string | Date).getTime();
  return Number.isFinite(t) ? t : null;
};

/** Today's date in UTC — quotas reset at 00:00 UTC. */
export function usageDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function newRefCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(7);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Paid plan while it lasts, else Pro during a trial or referral bonus, else free. */
export function effectivePlan(row: PlanRow, now = Date.now()): PlanState {
  const paidUntil = ms(row.plan_until);
  const trialUntil = ms(row.trial_until);
  const base = {
    refCode: row.ref_code,
    referredBy: row.referred_by,
    refBonusDays: Number(row.ref_bonus_days) || 0,
  };
  if ((row.plan === "pro" || row.plan === "max") && paidUntil && paidUntil > now) {
    return { ...base, plan: row.plan, until: paidUntil, trial: false };
  }
  if (trialUntil && trialUntil > now)
    return { ...base, plan: "pro", until: trialUntil, trial: true };
  return { ...base, plan: "free", until: null, trial: false };
}

/** The member's plan row, created on first use with the welcome trial. */
export async function loadPlan(sql: SqlLike, userId: string, now = Date.now()): Promise<PlanState> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rows = await sql<PlanRow>`
      select user_id, plan, plan_until, trial_until, ref_code, referred_by, ref_bonus_days
      from user_plan where user_id = ${userId}`;
    if (rows[0]) return effectivePlan(rows[0], now);
    const trialUntil = TRIAL_DAYS > 0 ? new Date(now + TRIAL_DAYS * DAY_MS) : null;
    await sql`
      insert into user_plan (user_id, ref_code, trial_until)
      values (${userId}, ${newRefCode()}, ${trialUntil})
      on conflict do nothing`;
  }
  throw new Error("could not create plan row");
}

export async function usageToday(
  sql: SqlLike,
  userId: string,
  now = Date.now(),
): Promise<Record<AiKind, number>> {
  const rows = await sql<{ kind: string; count: number }>`
    select kind, count from ai_usage where user_id = ${userId} and day = ${usageDay(now)}`;
  const used = Object.fromEntries(AI_KINDS.map((k) => [k, 0])) as Record<AiKind, number>;
  for (const row of rows)
    if ((AI_KINDS as readonly string[]).includes(row.kind))
      used[row.kind as AiKind] = Number(row.count);
  return used;
}

export type Consumed =
  | { ok: true; plan: PlanId; refund: () => Promise<void> }
  | { ok: false; plan: PlanId; limit: number };

/**
 * Takes one AI request from today's allowance, atomically: the increment only
 * happens while the count is under the plan's limit. `refund` gives it back
 * when the AI call fails, so members don't pay for errors.
 */
export async function consumeAi(
  sql: SqlLike,
  userId: string,
  kind: AiKind,
  opts: { unlimited?: boolean; now?: number } = {},
): Promise<Consumed> {
  const now = opts.now ?? Date.now();
  const state = await loadPlan(sql, userId, now);
  const limit = opts.unlimited ? 100_000 : PLANS[state.plan].limits[kind];
  if (limit <= 0) return { ok: false, plan: state.plan, limit };
  const day = usageDay(now);
  const rows = await sql<{ count: number }>`
    insert into ai_usage (user_id, day, kind, count) values (${userId}, ${day}, ${kind}, 1)
    on conflict (user_id, day, kind) do update set count = ai_usage.count + 1
    where ai_usage.count < ${limit}
    returning count`;
  if (!rows.length) return { ok: false, plan: state.plan, limit };
  return {
    ok: true,
    plan: state.plan,
    refund: async () => {
      await sql`update ai_usage set count = greatest(count - 1, 0) where user_id = ${userId} and day = ${day} and kind = ${kind}`;
    },
  };
}

/** Adds days of a paid plan. Time left on the current plan carries over. */
export async function grantPlan(
  sql: SqlLike,
  userId: string,
  plan: PaidPlan,
  days: number,
  now = Date.now(),
): Promise<PlanState> {
  const state = await loadPlan(sql, userId, now);
  let carry = 0;
  if (
    !state.trial &&
    (state.plan === "pro" || state.plan === "max") &&
    state.until &&
    state.until > now
  ) {
    // Time left on the current plan carries over at its value: 30 Pro days become 30 × 9/24 Max days.
    carry = (state.until - now) * (PLANS[state.plan].month / PLANS[plan].month);
  }
  const until = new Date(now + carry + days * DAY_MS);
  await sql`update user_plan set plan = ${plan}, plan_until = ${until}, updated_at = now() where user_id = ${userId}`;
  return loadPlan(sql, userId, now);
}

/** Sets a member back to the free plan (admin). */
export async function revokePlan(sql: SqlLike, userId: string): Promise<void> {
  await loadPlan(sql, userId);
  await sql`update user_plan set plan = 'free', plan_until = null, trial_until = null, updated_at = now() where user_id = ${userId}`;
}

export type ReferralResult = "ok" | "ok_no_bonus" | "already" | "bad_code" | "self" | "too_late";

/**
 * A new member who arrived by a friend's link: they get a longer trial, the
 * friend earns Pro days (capped, and not when both use the same IP address).
 */
export async function claimReferral(
  sql: SqlLike,
  userId: string,
  code: string,
  opts: { ip?: string | null; now?: number } = {},
): Promise<ReferralResult> {
  const now = opts.now ?? Date.now();
  const me = await loadPlan(sql, userId, now);
  if (me.referredBy) return "already";
  const [user] = await sql<{
    createdAt: unknown;
  }>`select "createdAt" from "user" where id = ${userId}`;
  const createdAt = ms(user?.createdAt) ?? now;
  if (now - createdAt > 2 * DAY_MS) return "too_late";
  const [inviter] = await sql<PlanRow>`
    select user_id, plan, plan_until, trial_until, ref_code, referred_by, ref_bonus_days
    from user_plan where ref_code = ${code.trim().toLowerCase()}`;
  if (!inviter) return "bad_code";
  if (inviter.user_id === userId) return "self";

  const updated = await sql`
    update user_plan set referred_by = ${inviter.user_id},
      trial_until = greatest(coalesce(trial_until, now()), ${new Date(createdAt + REFERRED_TRIAL_DAYS * DAY_MS)}),
      updated_at = now()
    where user_id = ${userId} and referred_by is null
    returning user_id`;
  if (!updated.length) return "already";

  if (opts.ip) {
    const sameIp =
      await sql`select 1 from "session" where "userId" = ${inviter.user_id} and "ipAddress" = ${opts.ip} limit 1`;
    if (sameIp.length) return "ok_no_bonus";
  }
  if ((Number(inviter.ref_bonus_days) || 0) + REFERRAL_BONUS_DAYS > REFERRAL_BONUS_CAP)
    return "ok_no_bonus";
  const state = effectivePlan(inviter, now);
  const bonusMs = REFERRAL_BONUS_DAYS * DAY_MS;
  if (!state.trial && state.plan !== "free" && state.until) {
    await sql`update user_plan set plan_until = ${new Date(state.until + bonusMs)}, ref_bonus_days = ref_bonus_days + ${REFERRAL_BONUS_DAYS}
      where user_id = ${inviter.user_id}`;
  } else {
    const from = Math.max(now, ms(inviter.trial_until) ?? 0);
    await sql`update user_plan set trial_until = ${new Date(from + bonusMs)}, ref_bonus_days = ref_bonus_days + ${REFERRAL_BONUS_DAYS}
      where user_id = ${inviter.user_id}`;
  }
  return "ok";
}

export async function referralCount(sql: SqlLike, userId: string): Promise<number> {
  const [row] = await sql<{
    n: number;
  }>`select count(*)::int as n from user_plan where referred_by = ${userId}`;
  return Number(row?.n ?? 0);
}

export type PaymentRow = {
  id: string;
  userId: string;
  plan: PaidPlan;
  period: Period;
  amount: number;
  provider: string;
  status: string;
  createdAt: number;
  paidAt: number | null;
  email?: string;
};

export async function createPayment(
  sql: SqlLike,
  userId: string,
  plan: PaidPlan,
  period: Period,
  provider: string,
): Promise<PaymentRow> {
  const id = randomUUID();
  const amount = priceOf(plan, period);
  await sql`insert into payments (id, user_id, plan, period, amount, provider) values (${id}, ${userId}, ${plan}, ${period}, ${amount}, ${provider})`;
  return {
    id,
    userId,
    plan,
    period,
    amount,
    provider,
    status: "pending",
    createdAt: Date.now(),
    paidAt: null,
  };
}

export async function setPaymentExternalId(
  sql: SqlLike,
  id: string,
  externalId: string,
): Promise<void> {
  await sql`update payments set external_id = ${externalId} where id = ${id}`;
}

export async function getPayment(sql: SqlLike, id: string): Promise<PaymentRow | null> {
  const [row] = await sql<Record<string, unknown>>`select * from payments where id = ${id}`;
  return row ? toPayment(row) : null;
}

/**
 * Marks a payment paid and grants the plan — once. A provider retrying its
 * webhook, or two webhooks racing, can't grant the plan twice.
 */
export async function markPaid(
  sql: SqlLike,
  id: string,
  paidAmount: number | null,
): Promise<"granted" | "already" | "unknown" | "amount_mismatch"> {
  const payment = await getPayment(sql, id);
  if (!payment) return "unknown";
  if (paidAmount !== null && paidAmount + 0.01 < payment.amount) return "amount_mismatch";
  const rows =
    await sql`update payments set status = 'paid', paid_at = now() where id = ${id} and status <> 'paid' returning id`;
  if (!rows.length) return "already";
  await grantPlan(sql, payment.userId, payment.plan, PERIOD_DAYS[payment.period]);
  return "granted";
}

export async function markFailed(sql: SqlLike, id: string): Promise<void> {
  await sql`update payments set status = 'failed' where id = ${id} and status = 'pending'`;
}

function toPayment(row: Record<string, unknown>): PaymentRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    plan: row.plan === "max" ? "max" : "pro",
    period: row.period === "year" ? "year" : "month",
    amount: Number(row.amount),
    provider: String(row.provider),
    status: String(row.status),
    createdAt: ms(row.created_at) ?? 0,
    paidAt: ms(row.paid_at),
    ...(row.email ? { email: String(row.email) } : {}),
  };
}

export async function recentPayments(sql: SqlLike, limit = 50): Promise<PaymentRow[]> {
  const rows = await sql<Record<string, unknown>>`
    select p.*, u.email from payments p join "user" u on u.id = p.user_id
    order by p.created_at desc limit ${limit}`;
  return rows.map(toPayment);
}

export async function userPayments(sql: SqlLike, userId: string): Promise<PaymentRow[]> {
  const rows = await sql<
    Record<string, unknown>
  >`select * from payments where user_id = ${userId} order by created_at desc limit 20`;
  return rows.map(toPayment);
}

export type AdminStats = {
  users: number;
  usersToday: number;
  users7d: number;
  paidActive: number;
  trialActive: number;
  revenue30d: number;
  revenueTotal: number;
  aiToday: number;
  referred: number;
};

export async function adminStats(sql: SqlLike, now = Date.now()): Promise<AdminStats> {
  const since = (days: number) => new Date(now - days * DAY_MS);
  const nowDate = new Date(now);
  const [[u], [p], [r], [a]] = await Promise.all([
    sql<{ total: number; today: number; week: number }>`
      select count(*)::int as total,
        count(*) filter (where "createdAt" > ${since(1)})::int as today,
        count(*) filter (where "createdAt" > ${since(7)})::int as week
      from "user"`,
    sql<{ paid: number; trial: number; referred: number }>`
      select count(*) filter (where plan in ('pro','max') and plan_until > ${nowDate})::int as paid,
        count(*) filter (where trial_until > ${nowDate} and not (plan in ('pro','max') and plan_until > ${nowDate}))::int as trial,
        count(*) filter (where referred_by is not null)::int as referred
      from user_plan`,
    sql<{ month: number; total: number }>`
      select coalesce(sum(amount) filter (where paid_at > ${since(30)}), 0)::float as month,
        coalesce(sum(amount), 0)::float as total
      from payments where status = 'paid'`,
    sql<{
      n: number;
    }>`select coalesce(sum(count), 0)::int as n from ai_usage where day = ${usageDay(now)}`,
  ]);
  return {
    users: Number(u?.total ?? 0),
    usersToday: Number(u?.today ?? 0),
    users7d: Number(u?.week ?? 0),
    paidActive: Number(p?.paid ?? 0),
    trialActive: Number(p?.trial ?? 0),
    referred: Number(p?.referred ?? 0),
    revenue30d: Number(r?.month ?? 0),
    revenueTotal: Number(r?.total ?? 0),
    aiToday: Number(a?.n ?? 0),
  };
}

export async function findUserByEmail(
  sql: SqlLike,
  email: string,
): Promise<{ id: string; email: string; name: string } | null> {
  const [row] = await sql<{ id: string; email: string; name: string }>`
    select id, email, name from "user" where lower(email) = ${email.trim().toLowerCase()}`;
  return row ?? null;
}
