/** Shared handling for payment webhooks — **server-only**. */
import type { WebhookResult } from "./payments.server";

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });

export async function settlePayment(result: WebhookResult, provider: string): Promise<Response> {
  if (!result) return text("bad signature", 401);
  if (!result.paymentId) return text("ok", 200);
  const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
  const sql = await getSql();
  if (result.paid) {
    const outcome = await store.markPaid(sql, result.paymentId, result.amount);
    console.log(`[billing] ${provider} payment ${result.paymentId}: ${outcome}`);
    if (outcome === "amount_mismatch")
      console.error(`[billing] ${provider} paid less than the price for ${result.paymentId}`);
  } else if (result.failed) {
    await store.markFailed(sql, result.paymentId);
  }
  // Always 200 once the signature checks out, so the provider stops retrying.
  return text("ok", 200);
}
