import { createFileRoute } from "@tanstack/react-router";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/**
 * Checks every active alert and sends what fired. The server checks by itself
 * every 5 minutes (scheduler.server.ts); this is the backup for an outside
 * scheduler such as cron-job.org, called with ?key=CRON_SECRET.
 */
async function handle(request: Request): Promise<Response> {
  const tg = await import("@/lib/telegram.server");
  const url = new URL(request.url);
  const given = url.searchParams.get("key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!tg.sameSecret(given, tg.cronSecret())) return json({ error: "unauthorized" }, 401);
  if (!tg.botToken()) return json({ ok: true, skipped: "no_bot" });
  const [{ runAlerts }, { siteOrigin }] = await Promise.all([import("@/lib/alerts-engine.server"), import("@/lib/http.server")]);
  try {
    return json({ ok: true, ...(await runAlerts(siteOrigin(request))) });
  } catch (err) {
    console.error("[alerts] run failed:", err instanceof Error ? err.message : err);
    return json({ ok: false, error: "failed" }, 500);
  }
}

export const Route = createFileRoute("/api/cron/alerts")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
