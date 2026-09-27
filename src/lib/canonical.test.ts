import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalRedirect } from "./canonical.ts";

test("production vercel.app visits move to the own domain, path and query kept", () => {
  assert.equal(
    canonicalRedirect("https://scan-delta-ashy.vercel.app/coins/bitcoin?ref=abc", "skan.ai", "production"),
    "https://skan.ai/coins/bitcoin?ref=abc",
  );
  assert.equal(canonicalRedirect("https://scan-delta-ashy.vercel.app/", "https://www.skan.ai/", "production"), "https://www.skan.ai/");
  assert.equal(canonicalRedirect("https://scan-delta-ashy.vercel.app/pricing", "skan.ai", "production", "HEAD"), "https://skan.ai/pricing");
  assert.equal(canonicalRedirect("https://skan.onrender.com/signals", "skan.ai", "production"), "https://skan.ai/signals");
});

test("no redirect without a domain, outside production, or already on the domain", () => {
  assert.equal(canonicalRedirect("https://scan-delta-ashy.vercel.app/", undefined, "production"), null);
  assert.equal(canonicalRedirect("https://takt-git-branch.vercel.app/", "skan.ai", "preview"), null);
  assert.equal(canonicalRedirect("https://skan.ai/pricing", "skan.ai", "production"), null);
  assert.equal(canonicalRedirect("http://localhost:8090/", "skan.ai", "production"), null);
});

test("callbacks, webhooks and server functions keep working on the old address", () => {
  const old = "https://scan-delta-ashy.vercel.app";
  assert.equal(canonicalRedirect(`${old}/api/auth/callback/google?code=x`, "skan.ai", "production"), null);
  assert.equal(canonicalRedirect(`${old}/api/billing/nowpayments`, "skan.ai", "production", "POST"), null);
  assert.equal(canonicalRedirect(`${old}/api/health`, "skan.ai", "production"), null);
  assert.equal(canonicalRedirect(`${old}/_serverFn/abc`, "skan.ai", "production"), null);
  assert.equal(canonicalRedirect(`${old}/pricing`, "skan.ai", "production", "POST"), null);
});
