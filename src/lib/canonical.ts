/** The hosting providers' own addresses (Vercel, Render). */
const TECHNICAL_HOSTS = [".vercel.app", ".onrender.com"];

/**
 * Where a production request on a technical address (*.vercel.app,
 * *.onrender.com) should go once the site has its own domain
 * (CANONICAL_HOST). Null means "stay".
 * Only page visits move: API routes (auth callbacks, payment webhooks, health)
 * and server functions keep answering on every address, so callbacks that
 * were registered with the old address never break.
 */
export function canonicalRedirect(
  requestUrl: string,
  canonicalHost: string | undefined,
  vercelEnv: string | undefined,
  method = "GET",
): string | null {
  const target = canonicalHost
    ?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!target || vercelEnv !== "production") return null;
  if (method !== "GET" && method !== "HEAD") return null;
  const url = new URL(requestUrl);
  if (!TECHNICAL_HOSTS.some((suffix) => url.hostname.endsWith(suffix)) || url.hostname === target) return null;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn")) return null;
  url.protocol = "https:";
  url.host = target;
  return url.toString();
}
