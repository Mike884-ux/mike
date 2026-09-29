import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/site/legal-page";

export const Route = createFileRoute("/_site/refund")({
  head: () => legalHead("refund"),
  component: () => <LegalPage doc="refund" />,
});
