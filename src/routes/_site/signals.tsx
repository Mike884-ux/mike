import { createFileRoute } from "@tanstack/react-router";
import { SignalsPage } from "@/components/scanner";
import { Container, MembersOnly } from "@/components/site/shell";

export const Route = createFileRoute("/_site/signals")({
  head: () => ({ meta: [{ title: "Сигналы по криптовалютам — Скан" }, { name: "description", content: "Технические сигналы на покупку и продажу по 8 индикаторам для крупных криптовалют и акций: RSI, тренд, объём и проверка точности на истории." }] }),
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
