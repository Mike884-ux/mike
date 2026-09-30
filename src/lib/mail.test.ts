import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrom } from "./mail.server.ts";

test("the sender is read from MAIL_FROM with or without a name", () => {
  assert.deepEqual(parseFrom("Скан <skan.app@gmail.com>"), { name: "Скан", email: "skan.app@gmail.com" });
  assert.deepEqual(parseFrom('"Skan" <a@b.co>'), { name: "Skan", email: "a@b.co" });
  assert.deepEqual(parseFrom("a@b.co"), { name: "Скан", email: "a@b.co" });
});
