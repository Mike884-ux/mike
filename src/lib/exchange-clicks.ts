import { createServerFn } from "@tanstack/react-start";
import { asExchange } from "./exchanges";
import { asCountry } from "./lang";

/** Public: counts a click through to an exchange. Fire-and-forget from the page. */
export const trackExchangeClick = createServerFn({ method: "POST" })
  .validator((input: { exchange?: string; country?: string }) => ({ exchange: asExchange(input.exchange), country: asCountry(input.country) }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    if (!data.exchange) return { ok: false };
    const [{ getSql }, store, { getRequest }, { clientIp }, { allow }] = await Promise.all([
      import("./db"),
      import("./exchange-clicks.server"),
      import("@tanstack/react-start/server"),
      import("./http.server"),
      import("./rate-limit"),
    ]);
    const request = getRequest();
    // A reload loop or a bot must not inflate the numbers.
    if (request && !allow(`ip:${clientIp(request)}`, "ex-click", 30, 60_000)) return { ok: false };
    await store.recordClick(await getSql(), data.exchange, data.country);
    return { ok: true };
  });

export function reportExchangeClick(exchange: string, country: string): void {
  void trackExchangeClick({ data: { exchange, country } }).catch(() => undefined);
}
