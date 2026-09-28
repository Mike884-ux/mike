import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asAlertKind, TECH_KINDS, type Alert } from "./alert-rules";
import { TAPE_CRYPTOS } from "./markets";
import { ALERT_LIMITS, SAVED_SCREEN_LIMITS, type PlanId } from "./plans";

export type { Alert, AlertKind } from "./alert-rules";
export type { SavedScreen } from "./alerts-store.server";

async function deps(userId: string, email: string) {
  const [{ getSql }, store, billing, { isAdminEmail }] = await Promise.all([
    import("./db"),
    import("./alerts-store.server"),
    import("./billing-store.server"),
    import("./quota.server"),
  ]);
  const sql = await getSql();
  const plan: PlanId = isAdminEmail(email) ? "max" : (await billing.loadPlan(sql, userId)).plan;
  return { sql, store, plan };
}

export type AlertsOverview = {
  alerts: Alert[];
  plan: PlanId;
  limit: number;
  screensLimit: number;
  telegram: { linked: boolean; username: string | null; bot: string | null };
};

async function botUsername(): Promise<string | null> {
  const tg = await import("./telegram.server");
  if (!tg.botToken()) return null;
  const [{ getSql }, { getSettings }] = await Promise.all([import("./db"), import("./billing-store.server")]);
  const saved = await getSettings(await getSql(), ["telegram:bot_username"]);
  return saved["telegram:bot_username"] ?? null;
}

export const getAlerts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AlertsOverview> => {
    const { sql, store, plan } = await deps(context.userId, context.email);
    const [alerts, link, bot] = await Promise.all([store.listAlerts(sql, context.userId), store.telegramLink(sql, context.userId), botUsername()]);
    return {
      alerts,
      plan,
      limit: ALERT_LIMITS[plan],
      screensLimit: SAVED_SCREEN_LIMITS[plan],
      telegram: { linked: Boolean(link), username: link?.username ?? null, bot },
    };
  });

export type CreateAlertResponse = { ok: true } | { ok: false; error: "pro" | "limit" | "bad_input" | "unsupported"; limit?: number };

export const addAlert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { symbol?: string; coinId?: string | null; kind?: string; value?: unknown }) => ({
    symbol: String(input.symbol ?? "").trim().toUpperCase().slice(0, 15),
    coinId: input.coinId ? String(input.coinId).slice(0, 100) : null,
    kind: asAlertKind(input.kind),
    value: input.value,
  }))
  .handler(async ({ data, context }): Promise<CreateAlertResponse> => {
    if (!data.kind) return { ok: false, error: "bad_input" };
    // Signal and RSI come from the scan, which covers the large coins only.
    if (TECH_KINDS.includes(data.kind) && !(TAPE_CRYPTOS as readonly string[]).includes(data.symbol)) return { ok: false, error: "unsupported" };
    const { sql, store, plan } = await deps(context.userId, context.email);
    const result = await store.createAlert(sql, context.userId, plan, { symbol: data.symbol, coinId: data.coinId, kind: data.kind, value: data.value });
    return result.ok ? { ok: true } : result;
  });

export const removeAlert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => ({ id: String(input.id ?? "").slice(0, 64) }))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { sql, store } = await deps(context.userId, context.email);
    return { ok: await store.deleteAlert(sql, context.userId, data.id) };
  });

export type TelegramConnect = { ok: true; url: string } | { ok: false; error: "not_configured" };

/** A one-time deep link that opens the bot and ties the chat to this account. */
export const connectTelegram = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TelegramConnect> => {
    const bot = await botUsername();
    if (!bot) return { ok: false, error: "not_configured" };
    const { sql, store } = await deps(context.userId, context.email);
    const code = await store.createLinkCode(sql, context.userId);
    return { ok: true, url: `https://t.me/${bot}?start=${code}` };
  });

export const disconnectTelegram = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { sql, store } = await deps(context.userId, context.email);
    await store.unlinkUser(sql, context.userId);
    return { ok: true };
  });

export const getScreens = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, store } = await deps(context.userId, context.email);
    return store.listScreens(sql, context.userId);
  });

export const addScreen = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name?: string; filters?: unknown }) => ({
    name: String(input.name ?? "").slice(0, 60),
    filters: input.filters && typeof input.filters === "object" ? input.filters : {},
  }))
  .handler(async ({ data, context }) => {
    const { sql, store, plan } = await deps(context.userId, context.email);
    return store.saveScreen(sql, context.userId, plan, data.name, data.filters);
  });

export const removeScreen = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => ({ id: String(input.id ?? "").slice(0, 64) }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { sql, store } = await deps(context.userId, context.email);
    await store.deleteScreen(sql, context.userId, data.id);
    return { ok: true };
  });
