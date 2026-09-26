import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/market/global")({
  server: {
    handlers: {
      GET: async () => {
        const { jsonResponse } = await import("@/lib/http.server");
        const { getGlobal } = await import("@/lib/coins.server");
        const stats = await getGlobal();
        return stats ? jsonResponse(stats, 200, { sMaxAge: 120 }) : jsonResponse({ error: "unavailable" }, 503);
      },
    },
  },
});
