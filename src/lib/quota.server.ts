/** Daily AI allowance per plan — **server-only**. */
import type { AiKind, PlanId } from "./plans";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

/**
 * Runs an AI call only if today's allowance has room, and gives the unit back
 * when the call fails. Admins are not limited.
 */
export async function withAiQuota<T extends { ok: boolean }>(
  ctx: { userId: string; email?: string },
  kind: AiKind,
  run: (plan: PlanId) => Promise<T>,
): Promise<T | { ok: false; reason: "limit" }> {
  const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
  const sql = await getSql();
  const taken = await store.consumeAi(sql, ctx.userId, kind, {
    unlimited: isAdminEmail(ctx.email),
  });
  if (!taken.ok) return { ok: false, reason: "limit" };
  try {
    const result = await run(taken.plan);
    if (!result.ok) await taken.refund().catch(() => undefined);
    return result;
  } catch (err) {
    await taken.refund().catch(() => undefined);
    throw err;
  }
}
