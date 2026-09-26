import { test } from "node:test";
import assert from "node:assert/strict";
import { numCompact, numFull, pctAbs, pctSigned, share, usdCompact, usdFull, usdPrice } from "./format.ts";

test("prices keep sensible precision at every size", () => {
  assert.equal(usdPrice(64012.345), "$64,012.35");
  assert.equal(usdPrice(2.4531), "$2.45");
  assert.equal(usdPrice(0.52341), "$0.5234");
  assert.equal(usdPrice(0.001234567), "$0.001235");
  assert.equal(usdPrice(0.0000123456), "$0.00001235");
  assert.equal(usdPrice(0), "$0.00");
  assert.equal(usdPrice(null), "—");
  assert.equal(usdPrice(Number.NaN), "—");
});

test("big numbers: full and compact", () => {
  assert.equal(usdFull(1262004512331.6), "$1,262,004,512,332");
  assert.equal(usdCompact(2.345e12), "$2.35T");
  assert.equal(usdCompact(85.214e9), "$85.21B");
  assert.equal(usdCompact(-1100), "-$1.10K");
  assert.equal(usdCompact(512), "$512");
  assert.equal(numCompact(19716000), "19.72M");
  assert.equal(numCompact(3.5), "3.5");
  assert.equal(numFull(19715000.4), "19,715,000");
});

test("percentages and shares", () => {
  assert.equal(pctAbs(-1.234), "1.23%");
  assert.equal(pctSigned(1.234), "+1.23%");
  assert.equal(pctSigned(-0.4), "−0.40%");
  assert.equal(pctSigned(0), "0.00%");
  assert.equal(share(19.7, 21), (19.7 / 21) * 100);
  assert.equal(share(30, 21), 100);
  assert.equal(share(1, null), null);
});
