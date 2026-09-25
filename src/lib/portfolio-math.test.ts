import { test } from "node:test";
import assert from "node:assert/strict";
import { averageIn, parseAmount, portfolioSeries } from "./portfolio-math.ts";

const DAY = 86_400_000;

test("crypto and stock candles at different times land in the same day", () => {
  const crypto = { qty: 1, candles: [0, 1, 2].map((d) => ({ t: d * DAY, c: 100 })) };
  // Stock daily bars stamped at 13:30 UTC and missing day 1 (weekend).
  const stock = { qty: 2, candles: [0, 2].map((d) => ({ t: d * DAY + 13.5 * 3600_000, c: 10 })) };
  const series = portfolioSeries([crypto, stock], DAY);
  assert.deepEqual(
    series.map((p) => p.value),
    [120, 120, 120],
  );
  assert.deepEqual(
    series.map((p) => p.t),
    [0, DAY, 2 * DAY],
  );
});

test("line starts only once every asset has a price", () => {
  const old = { qty: 1, candles: [0, 1, 2].map((d) => ({ t: d * DAY, c: 50 })) };
  const young = { qty: 1, candles: [{ t: 2 * DAY, c: 5 }] };
  assert.deepEqual(portfolioSeries([old, young], DAY), [{ t: 2 * DAY, value: 55 }]);
});

test("assets without any candles are ignored instead of blanking the chart", () => {
  const ok = { qty: 2, candles: [{ t: 0, c: 3 }] };
  assert.deepEqual(portfolioSeries([ok, { qty: 1, candles: [] }], DAY), [{ t: 0, value: 6 }]);
  assert.deepEqual(portfolioSeries([], DAY), []);
});

test("parseAmount accepts comma decimals and rejects junk", () => {
  assert.equal(parseAmount("0,5"), 0.5);
  assert.equal(parseAmount(" 1 200.25 "), 1200.25);
  assert.equal(parseAmount("12."), 12);
  assert.ok(Number.isNaN(parseAmount("abc")));
  assert.ok(Number.isNaN(parseAmount("1,2,3")));
  assert.ok(Number.isNaN(parseAmount("")));
});

test("averageIn sums quantity and weights the entry price", () => {
  assert.deepEqual(averageIn({ qty: 1, entry: 100 }, { qty: 1, entry: 200 }), {
    qty: 2,
    entry: 150,
  });
  assert.deepEqual(averageIn({ qty: 3, entry: 10 }, { qty: 1, entry: 50 }), { qty: 4, entry: 20 });
});
