import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/billing/admin-page";
import { Container, MembersOnly } from "@/components/site/shell";

export const Route = createFileRoute("/_site/admin")({
  head: () => ({ meta: [{ title: "Админ — Скан" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  return (
    <MembersOnly title="admin.gate.title" text="admin.gate.text">
      <Container className="py-8">
        <AdminPage />
      </Container>
    </MembersOnly>
  );
}
