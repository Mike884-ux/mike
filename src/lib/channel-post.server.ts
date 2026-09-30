/**
 * Posts the daily market review to the owner's Telegram channel — **server-only**.
 * The channel is set in /admin; the bot must be an admin there with the right
 * to post. The scheduler calls this every few minutes; it posts once a day.
 */
import { CHANNEL_POST_HOUR, channelPostText, localDay, type ReviewCoin } from "./channel-post";

const MAJORS = ["BTC", "ETH", "SOL", "BNB", "XRP", "TON"];
export const CHANNEL_KEY = "telegram:channel";
export const CHANNEL_LAST_KEY = "telegram:channel_last";

export type ChannelResult = "posted" | "skipped" | "no_channel" | "no_data";

export async function postDailyReview(opts: { force?: boolean; now?: number } = {}): Promise<ChannelResult> {
  const now = opts.now ?? Date.now();
  const [{ getSql }, store, tg] = await Promise.all([import("./db"), import("./billing-store.server"), import("./telegram.server")]);
  if (!tg.botToken()) return "no_channel";
  const sql = await getSql();
  const saved = await store.getSettings(sql, [CHANNEL_KEY, CHANNEL_LAST_KEY, "telegram:bot_username"]);
  const channel = saved[CHANNEL_KEY];
  if (!channel) return "no_channel";
  const local = localDay(now);
  if (!opts.force && (saved[CHANNEL_LAST_KEY] === local.day || local.hour < CHANNEL_POST_HOUR)) return "skipped";

  const coins = await import("./coins.server");
  const [listing, global] = await Promise.all([coins.getListing(1).catch(() => null), coins.getGlobal().catch(() => null)]);
  const top = listing?.coins ?? [];
  if (!top.length) return "no_data";
  const row = (c: (typeof top)[number]): ReviewCoin => ({ symbol: c.symbol.toUpperCase(), price: c.price, change24h: c.change24h });
  const bySymbol = new Map(top.map((c) => [c.symbol.toUpperCase(), c]));
  const majors = MAJORS.map((s) => bySymbol.get(s)).filter((c): c is (typeof top)[number] => Boolean(c)).map(row);
  // Stablecoins barely move; leave them out of the movers.
  const movers = top.filter((c) => c.change24h !== null && !/USD|DAI/.test(c.symbol.toUpperCase())).map(row);
  movers.sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));

  const text = channelPostText({
    date: local.label,
    majors,
    gainers: movers.slice(0, 3),
    losers: movers.slice(-3).reverse(),
    marketCapChange24h: global?.marketCapChange24h ?? null,
    fearGreed: global?.fearGreed ?? null,
  });
  const bot = saved["telegram:bot_username"];
  const site = process.env.CANONICAL_HOST?.trim()
    ? `https://${process.env.CANONICAL_HOST.trim().replace(/^https?:\/\//, "")}`
    : process.env.RENDER_EXTERNAL_URL?.trim().replace(/\/+$/, "");
  const buttons = [
    ...(bot ? [{ text: "🤖 Разбор ИИ в боте", url: `https://t.me/${bot}` }] : []),
    ...(site ? [{ text: "📈 Открыть Скан", url: site }] : []),
  ];
  await tg.tg("sendMessage", {
    chat_id: channel,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(buttons.length ? { reply_markup: { inline_keyboard: [buttons] } } : {}),
  });
  await store.setSettings(sql, { [CHANNEL_LAST_KEY]: local.day });
  console.log(`[channel] daily review posted to ${channel}`);
  return "posted";
}
