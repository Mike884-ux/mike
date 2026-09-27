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

/**
 * Headers that carry the visitor's address, most trusted first. Vercel sets
 * its own; Render sits behind Cloudflare, which overwrites CF-Connecting-IP,
 * while X-Forwarded-For there keeps whatever the client sent (only appended
 * to), so it is the last resort and read from the right.
 */
export const IP_HEADERS = process.env.RENDER
  ? ["cf-connecting-ip", "true-client-ip", "x-forwarded-for"]
  : ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"];

export function clientIp(request: Request): string {
  for (const name of IP_HEADERS) {
    const value = request.headers.get(name);
    if (!value) continue;
    const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
    const ip = process.env.RENDER && name === "x-forwarded-for" ? parts.at(-1) : parts[0];
    if (ip) return ip;
  }
  return "unknown";
}

/**
 * Per-IP budget for endpoints whose answers depend on free-form input (coin
 * ids, search text): those can't be served from the CDN, and a flood of
 * random ids would burn the shared CoinGecko quota for everyone.
 */
export function overBudget(request: Request, kind: string, max: number, windowMs = 60_000): Response | null {
  return allow(`ip:${clientIp(request)}`, kind, max, windowMs) ? null : jsonResponse({ error: "rate_limited" }, 429);
}

/**
 * The site's public address for links sent to payment providers (webhooks,
 * return pages). Behind Render's or Vercel's proxy the server itself is
 * reached over plain HTTP, so the proxy's X-Forwarded-Proto wins, and any
 * public host is https — providers refuse http:// webhook URLs.
 */
export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto === "https" || proto === "http") url.protocol = `${proto}:`;
  const local = /^(localhost|127\.|\[::1\]|0\.0\.0\.0|10\.|192\.168\.)/.test(url.hostname);
  if (!local) url.protocol = "https:";
  return url.origin;
}
