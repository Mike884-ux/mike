import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { appleClientSecret, appleEnabled } from "./apple.server.ts";

test("the Apple client secret is an ES256 JWT for the Services ID, signed with the .p8 key", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const env = { APPLE_CLIENT_ID: "com.skan.web", APPLE_TEAM_ID: "TEAM123", APPLE_KEY_ID: "KEY456", APPLE_PRIVATE_KEY: pem.replace(/\n/g, "\\n") };
  const now = Date.UTC(2026, 0, 1);
  const jwt = appleClientSecret(env, now)!;
  const [h, c, sig] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h!, "base64url").toString()), { alg: "ES256", kid: "KEY456" });
  const claims = JSON.parse(Buffer.from(c!, "base64url").toString());
  assert.equal(claims.iss, "TEAM123");
  assert.equal(claims.sub, "com.skan.web");
  assert.equal(claims.aud, "https://appleid.apple.com");
  assert.equal(claims.exp - claims.iat, 180 * 24 * 3600);
  assert.ok(verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(sig!, "base64url")));
  assert.equal(appleEnabled(env), true);
  assert.equal(appleEnabled({ ...env, APPLE_PRIVATE_KEY: "broken" }), false);
  assert.equal(appleEnabled({ APPLE_CLIENT_ID: "x" }), false);
  assert.equal(appleClientSecret({ APPLE_CLIENT_SECRET: "ready" }), "ready");
});
