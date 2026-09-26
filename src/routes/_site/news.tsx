import { createFileRoute } from "@tanstack/react-router";
import { News } from "@/components/news";
import { Container, MembersOnly } from "@/components/site/shell";

export const Route = createFileRoute("/_site/news")({ component: Page });

function Page() {
  return (
    <MembersOnly title="gate.news.title" text="gate.news.text">
      <Container className="py-6">
        <News />
      </Container>
    </MembersOnly>
  );
}
