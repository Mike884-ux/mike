import { createFileRoute } from "@tanstack/react-router";

const PAGES = ["/", "/screener", "/signals", "/converter", "/exchanges", "/guide/candles", "/pricing", "/news", "/trust", "/terms", "/privacy", "/refund"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** For search engines: the public pages and the top 300 coin pages. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [{ siteOrigin }, { getListing }] = await Promise.all([import("@/lib/http.server"), import("@/lib/coins.server")]);
        const origin = siteOrigin(request);
        const today = new Date().toISOString().slice(0, 10);
        const listings = await Promise.all([1, 2, 3].map((page) => getListing(page).catch(() => null)));
        const ids = [...new Set(listings.flatMap((l) => l?.coins ?? []).map((c) => c.id))];
        const url = (path: string, freq: string, priority: string) =>
          `  <url><loc>${esc(origin + path)}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`;
        const body = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...PAGES.map((p) => url(p, p === "/" ? "hourly" : "daily", p === "/" ? "1.0" : "0.7")),
          ...ids.map((id, i) => url(`/coins/${encodeURIComponent(id)}`, "hourly", i < 100 ? "0.8" : "0.6")),
          "</urlset>",
        ].join("\n");
        return new Response(body, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
        });
      },
    },
  },
});
