import { createFileRoute } from "@tanstack/react-router";
import { ConverterPage } from "@/components/market/converter-page";
import { Container } from "@/components/site/shell";

export const Route = createFileRoute("/_site/converter")({
  head: () => ({ meta: [{ title: "Конвертер криптовалют — Скан" }] }),
  component: () => (
    <Container className="py-8">
      <ConverterPage />
    </Container>
  ),
});
