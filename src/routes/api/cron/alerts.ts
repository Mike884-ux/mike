import { createFileRoute } from "@tanstack/react-router";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

let running: Promise<unknown> | null = null;

/**
 * Checks every active alert and sends what fired. Called every few minutes by
 * an outside scheduler (cron-job.org) with ?key=CRON_SECRET — which also keeps
 * a free Render instance from falling asleep.
 */
async function handle(request: Request): Promise<Response> {
  const tg = await import("@/lib/telegram.server");
  const url = new URL(request.url);
  const given = url.searchParams.get("key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!tg.sameSecret(given, tg.cronSecret())) return json({ error: "unauthorized" }, 401);
  if (!tg.botToken()) return json({ ok: true, skipped: "no_bot" });
  // Overlapping calls (a slow round plus the next tick) would send the same message twice.
  if (running) return json({ ok: true, skipped: "busy" });
  const [{ runAlerts }, { siteOrigin }] = await Promise.all([import("@/lib/alerts-engine.server"), import("@/lib/http.server")]);
  const job = runAlerts(siteOrigin(request));
  running = job;
  try {
    return json({ ok: true, ...(await job) });
  } catch (err) {
    console.error("[alerts] run failed:", err instanceof Error ? err.message : err);
    return json({ ok: false, error: "failed" }, 500);
  } finally {
    running = null;
  }
}

export const Route = createFileRoute("/api/cron/alerts")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
