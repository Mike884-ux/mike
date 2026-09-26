import { createFileRoute } from "@tanstack/react-router";

/**
 * Quick self-check for the owner: is a real database connected and migrated,
 * is AI configured. No secrets in the answer.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const { dbSource, getSql } = await import("@/lib/db");
        let tables = false;
        let error: string | null = null;
        try {
          const sql = await getSql();
          const [row] = await sql<{ ok: boolean }>`select to_regclass('public.user_plan') is not null as ok`;
          tables = Boolean(row?.ok);
        } catch (err) {
          error = err instanceof Error ? err.message.slice(0, 120) : "db error";
        }
        const has = (name: string) => Boolean(process.env[name]?.trim());
        const body = {
          ok: dbSource === "postgres" && tables,
          database: dbSource === "postgres" ? "connected" : "temporary (no DATABASE_URL)",
          tables,
          error,
          authSecret: has("BETTER_AUTH_SECRET"),
          ai: has("ANTHROPIC_API_KEY") || Boolean(process.env.VERCEL),
          admin: has("ADMIN_EMAILS"),
        };
        return new Response(JSON.stringify(body, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
