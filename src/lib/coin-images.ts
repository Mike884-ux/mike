import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

/**
 * Coin logos by ticker, from the top-500 market listing (CoinGecko images),
 * for places that only know a ticker — the AI scanner, the coin window. The
 * listing is cached on the server, so this costs no extra upstream calls.
 */
export const getCoinImages = createServerFn({ method: "GET" }).handler(async (): Promise<Record<string, string>> => {
  const { getListing } = await import("./coins.server");
  const pages = await Promise.all([1, 2, 3, 4, 5].map((page) => getListing(page).catch(() => null)));
  const images: Record<string, string> = {};
  for (const coin of pages.flatMap((p) => p?.coins ?? [])) {
    const symbol = coin.symbol.toUpperCase();
    // The higher-ranked coin keeps a ticker two coins share.
    if (coin.image && !images[symbol]) images[symbol] = coin.image;
  }
  return images;
});

export function useCoinImages() {
  return useQuery({ queryKey: ["coin-images"], queryFn: () => getCoinImages(), staleTime: 6 * 60 * 60_000, gcTime: Infinity });
}
