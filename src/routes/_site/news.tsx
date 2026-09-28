import { createFileRoute } from "@tanstack/react-router";
import { News } from "@/components/news";
import { Container, MembersOnly } from "@/components/site/shell";

export const Route = createFileRoute("/_site/news")({
  head: () => ({ meta: [{ title: "Новости криптовалют — Скан" }, { name: "description", content: "Свежие новости крипторынка: Bitcoin, Ethereum, альткоины, регулирование и ETF — коротко и по делу." }] }),
  component: Page,
});

function Page() {
  return (
    <MembersOnly title="gate.news.title" text="gate.news.text">
      <Container className="py-6">
        <News />
      </Container>
    </MembersOnly>
  );
}
