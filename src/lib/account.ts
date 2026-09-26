import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Account, TradeResult } from "./account-store.server";
import { asCountry, asLang } from "./lang";
import { assetOf, symbolOf } from "./markets";

export type { Account, WalletPosition, WalletTransaction } from "./account-store.server";

async function store() {
  const [{ getSql }, mod] = await Promise.all([import("./db"), import("./account-store.server")]);
  return { sql: await getSql(), mod };
}

/** Everything the signed-in user has saved: language, country, favorites, wallet, trades. */
export const getAccount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Account> => {
    const { sql, mod } = await store();
    return mod.loadAccount(sql, context.userId);
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { lang?: string; country?: string; favorites?: string[] }) => ({
    lang: input.lang === undefined ? undefined : asLang(input.lang),
    country: input.country === undefined ? undefined : asCountry(input.country),
    favorites: Array.isArray(input.favorites)
      ? [...new Set(input.favorites.map((b) => String(b).toUpperCase()).filter((b) => Boolean(assetOf(b))))].slice(0, 200)
      : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { sql, mod } = await store();
    await mod.saveSettings(sql, context.userId, {
      ...(data.lang ? { lang: data.lang } : {}),
      ...(data.country ? { country: data.country } : {}),
      ...(data.favorites ? { favorites: data.favorites } : {}),
    });
    return { ok: true as const };
  });

export const walletTrade = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { side?: string; base?: string; qty?: number; price?: number; note?: string }) => ({
    side: (input.side === "sell" ? "sell" : "buy") as "buy" | "sell",
    base: String(input.base ?? "").toUpperCase(),
    qty: Number(input.qty),
    price: Number(input.price),
    note: input.note ? String(input.note).slice(0, 200) : undefined,
  }))
  .handler(async ({ context, data }): Promise<TradeResult> => {
    // The symbol never comes from the browser: assets we follow get their exchange pair; any
    // other coin from the market listing is stored as "<TICKER>.CG" and priced via CoinGecko.
    const asset = assetOf(data.base);
    const base = asset?.base ?? (/^[A-Z0-9]{2,12}$/.test(data.base) ? data.base : null);
    if (!base) return { ok: false, error: "bad_input" };
    const { sql, mod } = await store();
    return mod.trade(sql, context.userId, { ...data, base, symbol: asset ? symbolOf(asset) : `${base}.CG` });
  });

export const walletRemove = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => ({ id: String(input.id ?? "").slice(0, 64) }))
  .handler(async ({ context, data }) => {
    const { sql, mod } = await store();
    return { ok: await mod.removePosition(sql, context.userId, data.id) };
  });

/** Moves a wallet kept in this browser (older versions of the site) into the account, once. */
export const walletImport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { positions?: { base?: string; qty?: number; entry?: number }[] }) => ({
    positions: (Array.isArray(input.positions) ? input.positions : []).slice(0, 60).flatMap((p) => {
      const asset = assetOf(String(p?.base ?? ""));
      const qty = Number(p?.qty);
      const entry = Number(p?.entry);
      return asset && qty > 0 && entry > 0 ? [{ base: asset.base, symbol: symbolOf(asset), qty, entry }] : [];
    }),
  }))
  .handler(async ({ context, data }) => {
    const { sql, mod } = await store();
    return { imported: await mod.importPositions(sql, context.userId, data.positions) };
  });
