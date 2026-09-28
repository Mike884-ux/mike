import { createFileRoute } from "@tanstack/react-router";

const ok = () => new Response("ok", { status: 200, headers: { "Cache-Control": "no-store" } });

/** Webhook for the site's Telegram bot (registered from /admin). */
export const Route = createFileRoute("/api/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tg = await import("@/lib/telegram.server");
        if (!tg.botToken()) return new Response("not configured", { status: 404 });
        if (!tg.sameSecret(request.headers.get("x-telegram-bot-api-secret-token"), tg.webhookSecret()))
          return new Response("forbidden", { status: 401 });
        const update = await request.json().catch(() => null);
        if (!update || typeof update !== "object") return ok();
        const [{ handleUpdate }, { siteOrigin }] = await Promise.all([import("@/lib/telegram-bot.server"), import("@/lib/http.server")]);
        await handleUpdate(update, siteOrigin(request));
        return ok();
      },
    },
  },
});
