import { createFileRoute } from "@tanstack/react-router";

/** Stripe webhook: signed with STRIPE_WEBHOOK_SECRET, grants the plan once Checkout is paid. */
export const Route = createFileRoute("/api/billing/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const [{ verifyStripe }, { settlePayment }] = await Promise.all([
          import("@/lib/payments.server"),
          import("@/lib/webhook.server"),
        ]);
        return settlePayment(verifyStripe(raw, request.headers.get("stripe-signature")), "stripe");
      },
    },
  },
});
