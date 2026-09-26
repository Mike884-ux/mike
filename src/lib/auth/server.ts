/**
 * Self-hosted Better Auth for this app — email/password, a one-time code by
 * email (when RESEND_API_KEY is set) and Google / X sign-in (when their client
 * keys are set). Sessions live in Postgres (DATABASE_URL) or the embedded
 * PGLite fallback.
 */
import { betterAuth } from "better-auth";
import { bearer, emailOTP } from "better-auth/plugins";
import { mailEnabled, sendMail } from "../mail.server";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { pgliteDialect } from "./pglite-dialect";

void ensureDbReady();

const isProduction = process.env.NODE_ENV === "production";

/**
 * The session-signing secret must be identical on every server instance.
 * A random per-process fallback meant each Vercel instance signed sessions
 * differently, so users were thrown back to the login screen whenever a
 * request landed on another instance — it looked like the site "reloading
 * itself". Without BETTER_AUTH_SECRET we now derive a stable secret from
 * another secret the deployment already has; random is the last resort.
 */
const globalAuthRef = globalThis as typeof globalThis & { __scannerAuthSecret__?: string };
function authSecret(): string {
  const configured = process.env.BETTER_AUTH_SECRET?.trim();
  if (configured) return configured;
  const seed = process.env.ANTHROPIC_API_KEY?.trim() || process.env.DATABASE_URL?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (seed) {
    if (isProduction) console.error("[auth] BETTER_AUTH_SECRET is not set — using a secret derived from another key. Set BETTER_AUTH_SECRET.");
    return createHash("sha256").update(`scan-auth-secret:v1:${seed}`).digest("hex");
  }
  if (isProduction) console.error("[auth] BETTER_AUTH_SECRET is not set — sessions will not survive a restart. Set it in the hosting env.");
  globalAuthRef.__scannerAuthSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__scannerAuthSecret__;
}

const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || undefined;
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

const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const twitterId = process.env.TWITTER_CLIENT_ID?.trim();
const twitterSecret = process.env.TWITTER_CLIENT_SECRET?.trim();

const OTP_SUBJECT = "Код для входа";
function otpText(otp: string): string {
  return `Ваш код для входа: ${otp}\n\nКод действует 10 минут. Если вы не запрашивали вход, просто не обращайте внимания на это письмо.\n\nYour sign-in code: ${otp} (valid for 10 minutes).`;
}

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
  socialProviders: {
    ...(googleId && googleSecret ? { google: { clientId: googleId, clientSecret: googleSecret } } : {}),
    ...(twitterId && twitterSecret ? { twitter: { clientId: twitterId, clientSecret: twitterSecret } } : {}),
  },
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
      "/email-otp/send-verification-otp": { window: 600, max: 4 },
      "/sign-in/email-otp": { window: 600, max: 8 },
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
  plugins: [
    bearer(),
    // Six-digit code by email; the plugin is harmless without a mail key since the page hides the option.
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
      async sendVerificationOTP({ email, otp, type }) {
        if (!mailEnabled()) throw new Error("mail is not configured");
        if (type !== "sign-in") return;
        await sendMail(email, OTP_SUBJECT, otpText(otp));
      },
    }),
    tanstackStartCookies(),
  ],
});
