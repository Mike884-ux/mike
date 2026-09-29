import { createServerFn } from "@tanstack/react-start";
import { EXCHANGES, isTradable, type ExchangePairs } from "./exchanges";

/** Public: where the coin trades — pairs per exchange, null where the list couldn't be checked. */
export const getExchangePairs = createServerFn({ method: "GET" })
  .validator((input: { base?: string }) => ({ base: String(input.base ?? "").toUpperCase().slice(0, 12) }))
  .handler(async ({ data }): Promise<ExchangePairs> => {
    if (!isTradable(data.base)) return Object.fromEntries(EXCHANGES.map((e) => [e, null])) as ExchangePairs;
    const { exchangePairs } = await import("./exchange-pairs.server");
    return exchangePairs(data.base);
  });
