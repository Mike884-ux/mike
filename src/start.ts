import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { canonicalRedirect } from "@/lib/canonical";

/**
 * Server functions answer only same-origin calls. Start adds this by itself
 * when there is no src/start.ts; with one, it has to be listed here.
 */
const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

/**
 * Own domain: when CANONICAL_HOST is set (e.g. "skan.ai"), production page
 * visits to the technical *.vercel.app / *.onrender.com address are sent there permanently,
 * path and query kept. Preview deployments keep working on their own addresses.
 */
const canonicalHost = createMiddleware({ type: "request" }).server(({ request, next }) => {
  // Render has no preview deployments: a Render server is always production.
  const env = process.env.VERCEL_ENV ?? (process.env.RENDER ? "production" : undefined);
  const location = canonicalRedirect(request.url, process.env.CANONICAL_HOST, env, request.method);
  if (location) return new Response(null, { status: 308, headers: { Location: location, "Cache-Control": "no-store" } });
  return next();
});

/**
 * On a long-running server the first request (Render's health check right
 * after a deploy) starts the background loop: Telegram bot, alerts, keep-awake.
 */
let schedulerStarted = false;
const scheduler = createMiddleware({ type: "request" }).server(({ next }) => {
  if (!schedulerStarted) {
    schedulerStarted = true;
    void import("@/lib/scheduler.server")
      .then((m) => m.ensureScheduler())
      .catch((err) => console.error("[scheduler] failed to start:", err));
  }
  return next();
});

export const startInstance = createStart(() => ({ requestMiddleware: [csrf, scheduler, canonicalHost] }));
