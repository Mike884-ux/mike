import { createFileRoute } from "@tanstack/react-router";

/** Dodo Payments webhook: signed with the saved (or DODO_WEBHOOK_SECRET) secret, grants the plan once the card payment succeeds. */
export const Route = createFileRoute("/api/billing/dodo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const [pay, { settlePayment }] = await Promise.all([import("@/lib/payments.server"), import("@/lib/webhook.server")]);
        const secret = pay.resolveDodo(await pay.storedDodo())?.webhookSecret;
        const result = pay.verifyDodo(
          raw,
          {
            id: request.headers.get("webhook-id"),
            timestamp: request.headers.get("webhook-timestamp"),
            signature: request.headers.get("webhook-signature"),
          },
          Date.now(),
          secret,
        );
        return settlePayment(result, "dodo");
      },
    },
  },
});
