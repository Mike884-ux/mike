import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "@/components/wallet";
import { Container, MembersOnly } from "@/components/site/shell";

export const Route = createFileRoute("/_site/portfolio")({ component: Page });

function Page() {
  return (
    <MembersOnly title="gate.portfolio.title" text="gate.portfolio.text">
      <Container className="py-6">
        <Wallet />
      </Container>
    </MembersOnly>
  );
}
