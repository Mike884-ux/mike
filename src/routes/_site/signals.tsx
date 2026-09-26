import { createFileRoute } from "@tanstack/react-router";
import { SignalsPage } from "@/components/scanner";
import { Container, MembersOnly } from "@/components/site/shell";

export const Route = createFileRoute("/_site/signals")({ component: Page });

function Page() {
  return (
    <MembersOnly title="gate.signals.title" text="gate.signals.text">
      <Container className="py-6">
        <SignalsPage />
      </Container>
    </MembersOnly>
  );
}
