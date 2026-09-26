import { createFileRoute } from "@tanstack/react-router";

/** NOWPayments IPN: signed with NOWPAYMENTS_IPN_SECRET, grants the plan when the crypto payment finishes. */
export const Route = createFileRoute("/api/billing/nowpayments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const [{ verifyNowpayments }, { settlePayment }] = await Promise.all([
          import("@/lib/payments.server"),
          import("@/lib/webhook.server"),
        ]);
        return settlePayment(
          verifyNowpayments(raw, request.headers.get("x-nowpayments-sig")),
          "nowpayments",
        );
      },
    },
  },
});
