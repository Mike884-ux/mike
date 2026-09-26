import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/market/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, overBudget } = await import("@/lib/http.server");
        const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 40);
        if (!query) return jsonResponse([], 200, { sMaxAge: 600 });
        const limited = overBudget(request, "market-search", 60);
        if (limited) return limited;
        const { searchCoins } = await import("@/lib/coins.server");
        return jsonResponse(await searchCoins(query), 200, { maxAge: 60, sMaxAge: 600 });
      },
    },
  },
});
