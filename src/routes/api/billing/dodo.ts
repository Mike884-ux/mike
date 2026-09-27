import { createFileRoute } from "@tanstack/react-router";

/** Dodo Payments webhook: signed with DODO_WEBHOOK_SECRET, grants the plan once the card payment succeeds. */
export const Route = createFileRoute("/api/billing/dodo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const [{ verifyDodo }, { settlePayment }] = await Promise.all([
          import("@/lib/payments.server"),
          import("@/lib/webhook.server"),
        ]);
        const result = verifyDodo(raw, {
          id: request.headers.get("webhook-id"),
          timestamp: request.headers.get("webhook-timestamp"),
          signature: request.headers.get("webhook-signature"),
        });
        return settlePayment(result, "dodo");
      },
    },
  },
});
