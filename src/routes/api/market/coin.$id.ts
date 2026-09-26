import { createFileRoute } from "@tanstack/react-router";
import { isCoinId } from "@/lib/coins";
import { asLang } from "@/lib/lang";

export const Route = createFileRoute("/api/market/coin/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { jsonResponse, overBudget } = await import("@/lib/http.server");
        const id = String(params.id ?? "").toLowerCase();
        if (!isCoinId(id)) return jsonResponse({ error: "not_found" }, 404);
        const limited = overBudget(request, "market-coin", 60);
        if (limited) return limited;
        const { getCoin } = await import("@/lib/coins.server");
        const lang = asLang(new URL(request.url).searchParams.get("lang"));
        const found = await getCoin(id, lang);
        if (!found) return jsonResponse({ error: "unavailable" }, 503);
        if ("notFound" in found) return jsonResponse({ error: "not_found" }, 404);
        return jsonResponse(found.info, 200, { sMaxAge: found.info.source === "coingecko" ? 120 : 30 });
      },
    },
  },
});
