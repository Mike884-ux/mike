import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/market/trending")({
  server: {
    handlers: {
      GET: async () => {
        const { jsonResponse } = await import("@/lib/http.server");
        const { getTrending } = await import("@/lib/coins.server");
        const coins = await getTrending();
        return coins ? jsonResponse(coins, 200, { sMaxAge: 300 }) : jsonResponse({ error: "unavailable" }, 503);
      },
    },
  },
});
