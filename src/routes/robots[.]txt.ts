import { createFileRoute } from "@tanstack/react-router";

/** Which pages search engines may index, and where the sitemap is. */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { siteOrigin } = await import("@/lib/http.server");
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin",
          "Disallow: /alerts",
          "Disallow: /login",
          "Disallow: /portfolio",
          "Disallow: /api/",
          "",
          `Sitemap: ${siteOrigin(request)}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
