import { createFileRoute } from "@tanstack/react-router";
import { CoinPage } from "@/components/coin/coin-page";

export const Route = createFileRoute("/_site/coins/$id")({
  component: CoinRoute,
});

function CoinRoute() {
  const { id } = Route.useParams();
  return <CoinPage key={id} id={id} />;
}
