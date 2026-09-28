/** Daily AI allowance per plan and for the whole site — **server-only**. */
import type { AiTier } from "./ai.server";
import type { AiKind, PlanId } from "./plans";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

/** Free members get the cheap model; Pro and Whale (a trial too) the stronger one. */
export function tierOf(plan: PlanId): AiTier {
  return plan === "free" ? "free" : "paid";
}

/** The model tier a member would be answered with, before anything is spent. */
export async function aiTierFor(ctx: { userId: string; email?: string }): Promise<AiTier> {
  if (isAdminEmail(ctx.email)) return "paid";
  const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
  return tierOf((await store.loadPlan(await getSql(), ctx.userId)).plan);
}

/**
 * Runs an AI call only if the member's allowance and the site's daily ceiling
 * (AI_DAILY_LIMIT) have room, and gives both back when the call fails.
 * Admins are not limited.
 */
export async function withAiQuota<T extends { ok: boolean }>(
  ctx: { userId: string; email?: string },
  kind: AiKind,
  run: (plan: PlanId, tier: AiTier) => Promise<T>,
): Promise<T | { ok: false; reason: "limit" | "busy" }> {
  const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
  const sql = await getSql();
  const admin = isAdminEmail(ctx.email);
  const taken = await store.consumeAi(sql, ctx.userId, kind, { unlimited: admin });
  if (!taken.ok) return { ok: false, reason: "limit" };
  try {
    const result = await withSiteBudget(ctx, () => run(taken.plan, admin ? "paid" : tierOf(taken.plan)));
    if (!result.ok) await taken.refund().catch(() => undefined);
    return result;
  } catch (err) {
    await taken.refund().catch(() => undefined);
    throw err;
  }
}

/**
 * Emergency brake against bot farms: past AI_DAILY_LIMIT real requests a day,
 * nobody but the owner gets new AI answers until tomorrow. A failed call gives
 * its request back.
 */
export async function withSiteBudget<T extends { ok: boolean }>(
  ctx: { email?: string },
  run: () => Promise<T>,
): Promise<T | { ok: false; reason: "busy" }> {
  if (isAdminEmail(ctx.email)) return run();
  const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
  const sql = await getSql();
  const limit = store.siteAiLimit();
  const release = await store.takeSiteAi(sql, limit);
  if (!release) {
    console.warn(`[ai] site daily limit reached (${limit})`);
    return { ok: false, reason: "busy" };
  }
  try {
    const result = await run();
    if (!result.ok) await release().catch(() => undefined);
    return result;
  } catch (err) {
    await release().catch(() => undefined);
    throw err;
  }
}
