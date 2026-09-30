import { test } from "node:test";
import assert from "node:assert/strict";
import { channelPostText, localDay, normalizeChannel } from "./channel-post.ts";

test("the channel name is accepted in any usual form", () => {
  assert.equal(normalizeChannel("@skan_crypto"), "@skan_crypto");
  assert.equal(normalizeChannel("skan_crypto"), "@skan_crypto");
  assert.equal(normalizeChannel("https://t.me/skan_crypto/"), "@skan_crypto");
  assert.equal(normalizeChannel("t.me/skan_crypto"), "@skan_crypto");
  assert.equal(normalizeChannel("-1001234567890"), "-1001234567890");
  assert.equal(normalizeChannel("bad name!"), null);
  assert.equal(normalizeChannel("@ab"), null);
});

test("the review day and hour follow Dushanbe time", () => {
  // 03:30 UTC is 08:30 in Dushanbe (UTC+5): not yet time to post.
  assert.deepEqual(localDay(Date.UTC(2026, 8, 30, 3, 30)), { day: "2026-09-30", hour: 8, label: "30.09.2026" });
  // 20:00 UTC is already 01:00 the next day there.
  assert.equal(localDay(Date.UTC(2026, 8, 30, 20)).day, "2026-10-01");
});

test("the review lists the main coins, movers and the mood, and ends with the disclaimer", () => {
  const text = channelPostText({
    date: "30.09.2026",
    majors: [
      { symbol: "BTC", price: 64000, change24h: 1.5 },
      { symbol: "ETH", price: 3100.5, change24h: -2.25 },
    ],
    gainers: [{ symbol: "PEPE", price: 0.0000123, change24h: 18.4 }],
    losers: [{ symbol: "WIF", price: 1.2, change24h: -9.1 }],
    marketCapChange24h: 0.8,
    fearGreed: { value: 63, label: "Greed" },
  });
  assert.match(text, /<b>BTC<\/b> \$64,000 · 🟢 \+1\.50%/);
  assert.match(text, /<b>ETH<\/b> \$3,101 · 🔴 -2\.25%/, "whole dollars above $1000");
  assert.match(text, /Индекс страха и жадности: <b>63<\/b> — жадность/);
  assert.match(text, /Лидеры роста<\/b>\nPEPE 🟢 \+18\.40%/);
  assert.match(text, /Лидеры падения<\/b>\nWIF 🔴 -9\.10%/);
  assert.match(text, /Не является инвестиционной рекомендацией/);
});
