import { createFileRoute } from "@tanstack/react-router";
import { AlertsPage } from "@/components/alerts/alerts-page";
import { MembersOnly } from "@/components/site/shell";

export const Route = createFileRoute("/_site/alerts")({
  head: () => ({ meta: [{ title: "Уведомления — Скан" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  return (
    <MembersOnly title="gate.alerts.title" text="gate.alerts.text">
      <AlertsPage />
    </MembersOnly>
  );
}
