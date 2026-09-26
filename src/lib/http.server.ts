/** Small helpers for the public JSON endpoints under /api/market — **server-only**. */
import { allow } from "./rate-limit";

type CacheOptions = { maxAge?: number; sMaxAge?: number; swr?: number };

/**
 * JSON with CDN caching. Vercel's edge keeps a successful answer for
 * `sMaxAge` seconds and serves it stale while refreshing, so thousands of
 * visitors cost the upstream APIs one request per minute, not one each.
 */
export function jsonResponse(data: unknown, status = 200, cache: CacheOptions = {}): Response {
  const { maxAge = 20, sMaxAge = 60, swr = 600 } = cache;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}` : "no-store",
    },
  });
}

export function clientIp(request: Request): string {
  const header =
    request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for") ?? "";
  return header.split(",")[0]?.trim() || "unknown";
}

/**
 * Per-IP budget for endpoints whose answers depend on free-form input (coin
 * ids, search text): those can't be served from the CDN, and a flood of
 * random ids would burn the shared CoinGecko quota for everyone.
 */
export function overBudget(request: Request, kind: string, max: number, windowMs = 60_000): Response | null {
  return allow(`ip:${clientIp(request)}`, kind, max, windowMs) ? null : jsonResponse({ error: "rate_limited" }, 429);
}
