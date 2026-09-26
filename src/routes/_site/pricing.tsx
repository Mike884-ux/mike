import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/billing/pricing-page";
import { Container } from "@/components/site/shell";

type PricingSearch = { paid?: boolean; canceled?: boolean };

export const Route = createFileRoute("/_site/pricing")({
  validateSearch: (search: Record<string, unknown>): PricingSearch => ({
    paid: search.paid === "1" || search.paid === 1 || search.paid === true ? true : undefined,
    canceled:
      search.canceled === "1" || search.canceled === 1 || search.canceled === true
        ? true
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Тарифы — Скан" }] }),
  component: Page,
});

function Page() {
  const { paid, canceled } = Route.useSearch();
  return (
    <Container className="py-10">
      <PricingPage paid={Boolean(paid)} canceled={Boolean(canceled)} />
    </Container>
  );
}
