import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { telegramEmail, telegramName, verifyInitData } from "./telegram-init.ts";

const TOKEN = "123456:TEST-token";

/** Signs launch data the way Telegram does. */
function sign(fields: Record<string, string>, token = TOKEN): string {
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

test("Telegram launch data: signed by this bot and fresh passes, anything else fails", () => {
  const now = Date.UTC(2026, 8, 30, 12);
  const user = { id: 777, first_name: "Али", last_name: "Р", username: "ali", language_code: "ru" };
  const fields = { query_id: "AAE", user: JSON.stringify(user), auth_date: String(now / 1000 - 60) };
  assert.deepEqual(verifyInitData(sign(fields), TOKEN, now), user);
  assert.equal(verifyInitData(sign(fields, "999:other-bot"), TOKEN, now), null, "another bot's data");
  const tampered = sign(fields).replace("777", "778");
  assert.equal(verifyInitData(tampered, TOKEN, now), null, "edited after signing");
  const old = { ...fields, auth_date: String(now / 1000 - 2 * 86400) };
  assert.equal(verifyInitData(sign(old), TOKEN, now), null, "too old");
  assert.equal(verifyInitData("", TOKEN, now), null);
  assert.equal(verifyInitData(sign(fields), "", now), null, "no bot token set");
  assert.equal(verifyInitData(sign({ auth_date: fields.auth_date }), TOKEN, now), null, "no user");
});

test("Telegram accounts get a readable name and a stand-in email", () => {
  assert.equal(telegramName({ id: 1, first_name: "Али", last_name: "Р" }), "Али Р");
  assert.equal(telegramName({ id: 1, username: "ali" }), "@ali");
  assert.equal(telegramName({ id: 1 }), "Telegram");
  assert.equal(telegramEmail(42), "tg42@telegram.skan");
});
