import { createFileRoute } from "@tanstack/react-router";
import { asRange, isCoinId } from "@/lib/coins";

export const Route = createFileRoute("/api/market/history/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { jsonResponse, overBudget } = await import("@/lib/http.server");
        const id = String(params.id ?? "").toLowerCase();
        if (!isCoinId(id)) return jsonResponse({ error: "not_found" }, 404);
        const limited = overBudget(request, "market-history", 90);
        if (limited) return limited;
        const url = new URL(request.url);
        const range = asRange(url.searchParams.get("range"));
        const rawSymbol = (url.searchParams.get("symbol") ?? "").toUpperCase();
        const symbol = /^[A-Z0-9]{1,15}$/.test(rawSymbol) ? rawSymbol : "";
        const refPrice = Number(url.searchParams.get("price"));
        const { getHistory } = await import("@/lib/coins.server");
        const history = await getHistory(id, symbol, range, Number.isFinite(refPrice) && refPrice > 0 ? refPrice : null);
        if (!history) return jsonResponse({ error: "unavailable" }, 503);
        const sMaxAge = range === "1d" ? 60 : range === "7d" ? 300 : 1800;
        return jsonResponse(history, 200, { maxAge: Math.min(sMaxAge, 120), sMaxAge });
      },
    },
  },
});
