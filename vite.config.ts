import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/**
 * Browser-side hardening sent with every response: no framing (clickjacking),
 * no MIME sniffing, HTTPS only, and a content policy that only lets the page
 * talk to its own server and load images from the coin/logo CDNs it uses.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    // Telegram's Mini App SDK, loaded only when the site runs inside Telegram.
    "script-src 'self' 'unsafe-inline' https://telegram.org",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://coin-images.coingecko.com https://assets.coingecko.com https://static.coinpaprika.com https://assets.coincap.io https://www.google.com https://*.gstatic.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    // Telegram Web shows Mini Apps in a frame; nobody else may frame the site.
    "frame-ancestors 'self' https://web.telegram.org",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
};

function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "coin-scanner:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[coin-scanner] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Where the server build runs: Vercel by default, a plain Node server on
 * Render (it sets RENDER=true while building), or NITRO_PRESET when given.
 */
const NITRO_PRESET = process.env.NITRO_PRESET?.trim() || (process.env.RENDER ? "node-server" : "vercel");

export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8090,
    strictPort: true,
    allowedHosts: [".trycloudflare.com"],
    watch: {
      ignored: ["**/.data/**", "**/.vercel/**"],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 8091,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset: NITRO_PRESET,
            // PGLite loads its WASM/data files from disk next to its own module.
            // Bundling it dropped pglite.data, and the server crashed on boot
            // whenever DATABASE_URL was unset. Trace the full package instead.
            traceDeps: ["@electric-sql/pglite*"],
            routeRules: { "/**": { headers: SECURITY_HEADERS } },
          }),
        ]
      : []),
    viteReact(),
  ],
}));
