import { createFileRoute } from "@tanstack/react-router";
import { asCategory, MAX_PAGES } from "@/lib/coins";

export const Route = createFileRoute("/api/market/listing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, overBudget } = await import("@/lib/http.server");
        const { getBySymbols, getListing } = await import("@/lib/coins.server");
        const url = new URL(request.url);
        const symbolsParam = url.searchParams.get("symbols");
        if (symbolsParam !== null) {
          const limited = overBudget(request, "market-symbols", 30);
          if (limited) return limited;
          const symbols = symbolsParam
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter((s) => /^[A-Z0-9]{1,15}$/.test(s))
            .slice(0, 60);
          const listing = await getBySymbols(symbols);
          return listing ? jsonResponse(listing) : jsonResponse({ error: "unavailable" }, 503);
        }
        const page = Math.min(MAX_PAGES, Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1)));
        const category = asCategory(url.searchParams.get("category"));
        const listing = await getListing(page, category);
        if (!listing) return jsonResponse({ error: "unavailable" }, 503);
        // Fallback data is cached briefly so the page returns to CoinGecko soon.
        return jsonResponse(listing, 200, { sMaxAge: listing.source === "coingecko" ? 60 : 20 });
      },
    },
  },
});
