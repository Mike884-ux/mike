/**
 * Self-hosted Better Auth for this app — email/password only, own database.
 * No external identity broker; sessions live in Postgres (DATABASE_URL) or the
 * embedded PGLite fallback.
 */
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { pgliteDialect } from "./pglite-dialect";

void ensureDbReady();

const isProduction = process.env.NODE_ENV === "production";

/** Secret must survive HMR reloads so PGLite-backed sessions don't invalidate mid-dev. */
const globalAuthRef = globalThis as typeof globalThis & { __scannerAuthSecret__?: string };
function authSecret(): string {
  const configured = process.env.BETTER_AUTH_SECRET?.trim();
  if (!configured && isProduction) {
    // A random per-process secret signs everyone out on every cold start (and
    // each serverless instance gets a different one). Say so loudly.
    console.error("[auth] BETTER_AUTH_SECRET is not set — sessions will not survive a restart. Set it in the hosting env.");
  }
  globalAuthRef.__scannerAuthSecret__ ??= configured || randomBytes(32).toString("hex");
  return globalAuthRef.__scannerAuthSecret__;
}

const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

/**
 * LAN / tunnel origins are for local development only. They used to be
 * trusted in production too, which let any page on *.trycloudflare.com (anyone
 * can open one) or a private-network address make credentialed auth requests.
 */
const LOCAL_DEV_ORIGINS = isProduction
  ? []
  : [
      "http://localhost:8090",
      "http://127.0.0.1:8090",
      "http://[::1]:8090",
      // LAN/hotspot access from a phone on the same network.
      "http://172.20.10.*:8090",
      "http://192.168.*.*:8090",
      "http://10.*.*.*:8090",
      // Cloudflare quick tunnel — subdomain is random per run.
      "https://*.trycloudflare.com",
    ];

/**
 * Hosts this deployment answers on. Vercel exposes its own domains as system
 * env vars; APP_HOSTS (comma-separated) adds custom domains. Without these the
 * dynamic base URL only accepted localhost, so sign-in broke once deployed.
 */
const deployHosts = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_URL,
  ...(process.env.APP_HOSTS ?? "").split(","),
]
  .map((host) => host?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
  .filter((host): host is string => Boolean(host));
const explicitBaseURL = process.env.BETTER_AUTH_URL?.trim() || undefined;
const trustedOrigins = [
  ...(explicitBaseURL ? [explicitBaseURL] : []),
  ...deployHosts.map((host) => `https://${host}`),
  ...LOCAL_DEV_ORIGINS,
];

export const auth = betterAuth({
  baseURL: explicitBaseURL ?? {
    allowedHosts: [...deployHosts, "localhost", "127.0.0.1", "[::1]", ...(isProduction ? [] : ["*.trycloudflare.com"])],
    protocol: "auto" as const,
    fallback: deployHosts[0] ? `https://${deployHosts[0]}` : "http://localhost:8090",
  },
  secret: authSecret(),
  database,
  trustedOrigins,
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
  /**
   * Per-IP limits, counted in the database so every serverless instance shares
   * them. Password guessing gets 5 tries a minute; account creation 5 an hour.
   */
  rateLimit: {
    enabled: isProduction || process.env.AUTH_RATE_LIMIT === "on",
    storage: "database",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/change-password": { window: 600, max: 5 },
    },
  },
  advanced: {
    defaultCookieAttributes: { sameSite: "lax", path: "/" },
    useSecureCookies: isProduction,
    ipAddress: {
      // Vercel sets x-vercel-forwarded-for / x-real-ip itself; clients can't forge them there.
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"],
    },
  },
  plugins: [bearer(), tanstackStartCookies()],
});
