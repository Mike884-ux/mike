import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/site/legal-page";

export const Route = createFileRoute("/_site/privacy")({
  head: () => legalHead("privacy"),
  component: () => <LegalPage doc="privacy" />,
});
