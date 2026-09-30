/**
 * Checks the launch data Telegram gives a Mini App ("initData"): Telegram
 * signs it with a key derived from the bot token, so only data Telegram
 * issued for this bot passes. Pure — shared by the sign-in endpoint and tests.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

/** How old a launch may be — the same Mini App tab can stay open for a day. */
export const INIT_DATA_MAX_AGE_S = 24 * 3600;

export function verifyInitData(initData: string, botToken: string, now = Date.now()): TelegramUser | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  params.delete("hash");
  const check = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(check).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > INIT_DATA_MAX_AGE_S) return null;
  try {
    const user = JSON.parse(params.get("user") ?? "") as TelegramUser;
    return Number.isSafeInteger(user?.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
}

/** A readable name for the account: "First Last", else @username, else "Telegram". */
export function telegramName(user: TelegramUser): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return (full || (user.username ? `@${user.username}` : "Telegram")).slice(0, 100);
}

export { isTelegramEmail, telegramEmail } from "./telegram-email.ts";
