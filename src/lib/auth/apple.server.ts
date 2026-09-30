/**
 * Sign in with Apple — **server-only**. Apple's "client secret" is a short-lived
 * ES256 JWT signed with the key from the Apple Developer account, so the site
 * makes it itself from APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY (the
 * .p8 file's text). A ready-made APPLE_CLIENT_SECRET wins when set.
 */
import { createPrivateKey, sign } from "node:crypto";

/** Apple accepts client secrets valid for up to six months. */
const LIFETIME_S = 180 * 24 * 3600;

const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");

export function appleClientSecret(env: NodeJS.ProcessEnv = process.env, now = Date.now()): string | null {
  const ready = env.APPLE_CLIENT_SECRET?.trim();
  if (ready) return ready;
  const clientId = env.APPLE_CLIENT_ID?.trim();
  const teamId = env.APPLE_TEAM_ID?.trim();
  const keyId = env.APPLE_KEY_ID?.trim();
  // Env editors often keep the key on one line with literal "\n".
  const pem = env.APPLE_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  if (!clientId || !teamId || !keyId || !pem) return null;
  try {
    const iat = Math.floor(now / 1000);
    const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
    const claims = b64url(JSON.stringify({ iss: teamId, iat, exp: iat + LIFETIME_S, aud: "https://appleid.apple.com", sub: clientId }));
    const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" });
    return `${header}.${claims}.${b64url(signature)}`;
  } catch (err) {
    console.error("[auth] APPLE_PRIVATE_KEY is not a valid .p8 key:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function appleEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.APPLE_CLIENT_ID?.trim() && appleClientSecret(env));
}
