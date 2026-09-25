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

/** Secret must survive HMR reloads so PGLite-backed sessions don't invalidate mid-dev. */
const globalAuthRef = globalThis as typeof globalThis & { __scannerAuthSecret__?: string };
function authSecret(): string {
  globalAuthRef.__scannerAuthSecret__ ??= process.env.BETTER_AUTH_SECRET ?? randomBytes(32).toString("hex");
  return globalAuthRef.__scannerAuthSecret__;
}

const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

const LOCAL_DEV_ORIGINS = [
  "http://localhost:8090",
  "http://127.0.0.1:8090",
  "http://[::1]:8090",
  // LAN/hotspot access from a phone on the same network — IP changes with the network, so wildcard the common ranges.
  "http://172.20.10.*:8090",
  "http://192.168.*.*:8090",
  "http://10.*.*.*:8090",
  // Cloudflare quick tunnel — subdomain is random per run.
  "https://*.trycloudflare.com",
];
const explicitBaseURL = process.env.BETTER_AUTH_URL?.trim() || undefined;

export const auth = betterAuth({
  baseURL: explicitBaseURL ?? {
    allowedHosts: ["localhost", "127.0.0.1", "[::1]"],
    protocol: "auto" as const,
    fallback: "http://localhost:8090",
  },
  secret: authSecret(),
  database,
  trustedOrigins: explicitBaseURL ? [explicitBaseURL, ...LOCAL_DEV_ORIGINS] : LOCAL_DEV_ORIGINS,
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  emailAndPassword: { enabled: true },
  advanced: {
    defaultCookieAttributes: { sameSite: "lax", path: "/" },
  },
  plugins: [bearer(), tanstackStartCookies()],
});
