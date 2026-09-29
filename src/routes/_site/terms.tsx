import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/site/legal-page";

export const Route = createFileRoute("/_site/terms")({
  head: () => legalHead("terms"),
  component: () => <LegalPage doc="terms" />,
});
