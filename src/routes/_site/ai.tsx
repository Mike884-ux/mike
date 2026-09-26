import { createFileRoute } from "@tanstack/react-router";
import { Chat } from "@/components/chat";
import { Container, MembersOnly } from "@/components/site/shell";

export const Route = createFileRoute("/_site/ai")({ component: Page });

function Page() {
  return (
    <MembersOnly title="gate.ai.title" text="gate.ai.text">
      <Container className="py-6">
        <div className="h-[calc(100dvh-13rem)] min-h-[520px]">
          <Chat />
        </div>
      </Container>
    </MembersOnly>
  );
}
