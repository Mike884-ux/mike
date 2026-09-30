import { createFileRoute } from "@tanstack/react-router";
import { SignalsPage } from "@/components/scanner";
import { Container, MembersOnly } from "@/components/site/shell";

export const Route = createFileRoute("/_site/signals")({
  head: () => ({ meta: [{ title: "ИИ-сканер криптовалют — Скан" }, { name: "description", content: "ИИ-сканер крупных криптовалют и акций: цена, RSI, тренд и объём, а ИИ разбирает график и говорит — покупать, продавать или подождать, с уровнями входа и стопа." }] }),
  component: Page,
});

function Page() {
  return (
    <MembersOnly title="gate.signals.title" text="gate.signals.text">
      <Container className="py-6">
        <SignalsPage />
      </Container>
    </MembersOnly>
  );
}
