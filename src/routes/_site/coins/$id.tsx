import { createFileRoute } from "@tanstack/react-router";
import { coinDescription, coinJsonLd, coinTitle, getCoinSeo, type CoinSeoResult } from "@/lib/seo";
import { CoinPage } from "@/components/coin/coin-page";

export const Route = createFileRoute("/_site/coins/$id")({
  // Only the server render needs it (for search engines and link previews);
  // in the browser the page loads the coin itself and sets the title.
  loader: async ({ params }): Promise<CoinSeoResult | null> =>
    typeof window === "undefined" ? getCoinSeo({ data: { id: params.id } }).catch(() => null) : null,
  head: ({ loaderData, params }) => {
    const coin = loaderData?.coin;
    if (!coin) return {};
    const url = `${loaderData.origin}/coins/${params.id}`;
    const title = coinTitle(coin);
    const description = coinDescription(coin);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Скан" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        ...(coin.image ? [{ property: "og:image", content: coin.image }] : []),
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: coinJsonLd(coin, loaderData.origin) }],
    };
  },
  component: CoinRoute,
});

function CoinRoute() {
  const { id } = Route.useParams();
  const seo = Route.useLoaderData()?.coin ?? null;
  return <CoinPage key={id} id={id} seo={seo} />;
}
