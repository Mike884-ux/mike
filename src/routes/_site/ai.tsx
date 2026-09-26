import { createFileRoute } from "@tanstack/react-router";
import { AiPage } from "@/components/ai-page";
import { Container, MembersOnly } from "@/components/site/shell";

type AiSearch = { q?: string; tab?: "chat" | "strategy" };

export const Route = createFileRoute("/_site/ai")({
  validateSearch: (search: Record<string, unknown>): AiSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.slice(0, 500) : undefined,
    tab: search.tab === "strategy" ? "strategy" : undefined,
  }),
  component: Page,
});

function Page() {
  const { q, tab } = Route.useSearch();
  return (
    <MembersOnly title="gate.ai.title" text="gate.ai.text">
      <Container className="py-6">
        <AiPage question={q} tab={tab ?? "chat"} />
      </Container>
    </MembersOnly>
  );
}
