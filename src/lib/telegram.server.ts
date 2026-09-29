/**
 * The site's Telegram bot: Bot API calls, webhook and cron secrets, and the
 * texts it sends — **server-only**.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Alert, Quote, Tech } from "./alert-rules.ts";
import { pctSigned, usdPrice } from "./format.ts";

const env = (name: string) => process.env[name]?.trim() ?? "";

/** Only the first word: people paste notes after keys. */
export function botToken(): string {
  return env("TELEGRAM_BOT_TOKEN").split(/\s+/)[0] ?? "";
}

function apiBase(): string {
  // Tests point this at a local fake; production always talks to Telegram.
  return env("TELEGRAM_API_BASE") || "https://api.telegram.org";
}

/** What Telegram must echo in X-Telegram-Bot-Api-Secret-Token — derived, so there is nothing extra to configure. */
export function webhookSecret(): string {
  const base = env("BETTER_AUTH_SECRET") || botToken();
  return createHmac("sha256", base).update("telegram-webhook").digest("base64url").slice(0, 48);
}

export function sameSecret(given: string | null | undefined, expected: string): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** CRON_SECRET, or one derived from the auth secret when the owner hasn't set it. */
export function cronSecret(): string {
  const own = env("CRON_SECRET").split(/\s+/)[0];
  if (own) return own;
  const base = env("BETTER_AUTH_SECRET");
  return base ? createHmac("sha256", base).update("alerts-cron").digest("base64url").slice(0, 32) : "";
}

export class TelegramError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = botToken();
  if (!token) throw new TelegramError(0, "no_token");
  const res = await fetch(`${apiBase()}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!res.ok || !data?.ok) throw new TelegramError(res.status, `${method}: ${data?.description ?? res.statusText}`);
  return data.result as T;
}

export function sendMessage(chatId: string | number, text: string): Promise<unknown> {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const BOT_COMMANDS = [
  { command: "btc", description: "Bitcoin: цена, RSI и вывод ИИ" },
  { command: "eth", description: "Ethereum: цена, RSI и вывод ИИ" },
  { command: "sol", description: "Solana: цена, RSI и вывод ИИ" },
  { command: "alerts", description: "Мои уведомления" },
  { command: "help", description: "Что умеет бот" },
  { command: "stop", description: "Отключить уведомления" },
];

/* ------------------------------------------------------------------ texts */

export type BotLang = "ru" | "en";
export const botLang = (value: string | null | undefined): BotLang => (value?.toLowerCase().startsWith("en") ? "en" : "ru");

const T = {
  ru: {
    welcome: "👋 Это бот сервиса <b>Скан</b>.\n\nНапишите тикер — например, <b>btc</b> или <b>/sol</b> — и я пришлю цену, RSI и вывод ИИ, если он уже готов.\n\nЧтобы получать уведомления о цене и RSI, подключите аккаунт на сайте: {site}/alerts",
    linked: "✅ Аккаунт подключён. Уведомления будут приходить сюда.\n\nНастроить их можно на странице монеты или здесь: {site}/alerts",
    badCode: "Ссылка устарела. Откройте {site}/alerts и нажмите «Подключить Telegram» ещё раз.",
    stopped: "Уведомления отключены. Подключить снова: {site}/alerts",
    notLinked: "Аккаунт не подключён. Откройте {site}/alerts и нажмите «Подключить Telegram».",
    noAlerts: "Уведомлений пока нет. Добавьте их на странице монеты — кнопка «🔔 Уведомить».",
    alerts: "🔔 Ваши уведомления:",
    unknown: "Не нашёл такую монету. Напишите тикер, например <b>btc</b>, <b>eth</b>, <b>sol</b>.",
    help: "Что я умею:\n• тикер (<b>btc</b>, <b>/eth</b>) — цена, изменение за сутки, RSI и вывод ИИ\n• /alerts — ваши уведомления\n• /stop — отключить уведомления\n\nСайт: {site}",
    change: "за 24ч",
    signal: "Сигнал (1ч)",
    ai: "🤖 ИИ: <b>{call}</b> · уверенность {n}%",
    aiCall: { LONG: "покупать", SHORT: "продавать", WAIT: "ждать" },
    rsi: "RSI",
    open: "Подробный разбор",
    disclaimer: "Не является инвестиционной рекомендацией.",
    LONG: "покупка",
    SHORT: "продажа",
    WAIT: "ожидание",
    above: "поднялась выше",
    below: "опустилась ниже",
    now: "Сейчас",
    move: "{symbol}: сильное движение за сутки",
    signalNew: "{symbol}: новый сигнал — {signal}",
    was: "было",
    rsiLow: "{symbol}: RSI {rsi} — ниже {value} (перепроданность)",
    rsiHigh: "{symbol}: RSI {rsi} — выше {value} (перекупленность)",
    kind: {
      price_above: "цена выше {v}",
      price_below: "цена ниже {v}",
      change_24h: "движение за сутки ≥ {v}%",
      signal: "смена сигнала",
      rsi_below: "RSI ниже {v}",
      rsi_above: "RSI выше {v}",
    },
  },
  en: {
    welcome: "👋 This is the <b>Scan</b> bot.\n\nSend a ticker — like <b>btc</b> or <b>/sol</b> — for the price, RSI and the AI's call when it's ready.\n\nTo get price and RSI alerts, connect your account on the site: {site}/alerts",
    linked: "✅ Account connected. Alerts will arrive here.\n\nSet them up on a coin page or here: {site}/alerts",
    badCode: "This link has expired. Open {site}/alerts and tap “Connect Telegram” again.",
    stopped: "Alerts are off. Connect again: {site}/alerts",
    notLinked: "Your account isn't connected. Open {site}/alerts and tap “Connect Telegram”.",
    noAlerts: "No alerts yet. Add them on a coin page — the “🔔 Alert me” button.",
    alerts: "🔔 Your alerts:",
    unknown: "I don't know that coin. Send a ticker like <b>btc</b>, <b>eth</b>, <b>sol</b>.",
    help: "What I can do:\n• a ticker (<b>btc</b>, <b>/eth</b>) — price, 24h change, RSI and the AI's call\n• /alerts — your alerts\n• /stop — turn alerts off\n\nSite: {site}",
    change: "24h",
    signal: "Signal (1h)",
    ai: "🤖 AI: <b>{call}</b> · confidence {n}%",
    aiCall: { LONG: "buy", SHORT: "sell", WAIT: "wait" },
    rsi: "RSI",
    open: "Full breakdown",
    disclaimer: "Not investment advice.",
    LONG: "buy",
    SHORT: "sell",
    WAIT: "wait",
    above: "went above",
    below: "went below",
    now: "Now",
    move: "{symbol}: big move in 24h",
    signalNew: "{symbol}: new signal — {signal}",
    was: "was",
    rsiLow: "{symbol}: RSI {rsi} — below {value} (oversold)",
    rsiHigh: "{symbol}: RSI {rsi} — above {value} (overbought)",
    kind: {
      price_above: "price above {v}",
      price_below: "price below {v}",
      change_24h: "24h move ≥ {v}%",
      signal: "signal change",
      rsi_below: "RSI below {v}",
      rsi_above: "RSI above {v}",
    },
  },
} as const;

const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

export function botText(lang: BotLang, key: Exclude<keyof (typeof T)["ru"], "kind" | "aiCall">, vars: Record<string, string | number> = {}): string {
  return fill(T[lang][key], vars);
}

export function alertLabel(lang: BotLang, alert: Pick<Alert, "kind" | "value">): string {
  const v = alert.kind === "price_above" || alert.kind === "price_below" ? usdPrice(alert.value) : String(alert.value ?? "");
  return fill(T[lang].kind[alert.kind], { v });
}

export type AiCall = { direction: "LONG" | "SHORT" | "WAIT"; confidence: number };
export type CoinLine = { symbol: string; name: string; quote: Quote | null; tech: Tech | null; ai?: AiCall | null; url: string | null };

/** "/btc": price, the day's move, RSI, the AI's call when one is ready, and a link to the full page. */
export function coinMessage(lang: BotLang, coin: CoinLine): string {
  const t = T[lang];
  const lines = [`<b>${escapeHtml(coin.name)} (${escapeHtml(coin.symbol)})</b>`];
  if (coin.quote) lines.push(`${usdPrice(coin.quote.price)}  ${pctSigned(coin.quote.change24h)} ${t.change}`);
  if (coin.tech) lines.push(`${t.rsi} (1h): ${Math.round(coin.tech.rsi)}`);
  if (coin.ai) lines.push(fill(t.ai, { call: t.aiCall[coin.ai.direction], n: Math.round(coin.ai.confidence) }));
  if (coin.url) lines.push("", `<a href="${escapeHtml(coin.url)}">${t.open} →</a>`);
  lines.push("", `<i>${t.disclaimer}</i>`);
  return lines.join("\n");
}

/** The message for a fired alert. */
export function alertMessage(
  lang: BotLang,
  alert: Pick<Alert, "kind" | "value" | "symbol" | "state">,
  quote: Quote | null,
  tech: Tech | null,
  url: string | null,
): string {
  const t = T[lang];
  const symbol = escapeHtml(alert.symbol);
  let head: string;
  switch (alert.kind) {
    case "price_above":
    case "price_below":
      head = `🔔 <b>${symbol}</b> ${alert.kind === "price_above" ? t.above : t.below} ${usdPrice(alert.value)}`;
      break;
    case "change_24h":
      head = `⚡ <b>${fill(t.move, { symbol })}</b>`;
      break;
    case "signal":
      head = `${tech?.signal === "SHORT" ? "📉" : "📈"} <b>${fill(t.signalNew, { symbol, signal: tech ? t[tech.signal] : "" })}</b>`;
      if (alert.state === "LONG" || alert.state === "SHORT" || alert.state === "WAIT") head += ` (${t.was}: ${t[alert.state]})`;
      break;
    case "rsi_below":
    case "rsi_above":
      head = `${alert.kind === "rsi_below" ? "🟢" : "🔴"} <b>${fill(alert.kind === "rsi_below" ? t.rsiLow : t.rsiHigh, { symbol, rsi: Math.round(tech?.rsi ?? 0), value: alert.value ?? "" })}</b>`;
      break;
  }
  const lines = [head];
  if (quote) lines.push(`${t.now}: ${usdPrice(quote.price)}  ${pctSigned(quote.change24h)} ${t.change}`);
  if (url) lines.push(`<a href="${escapeHtml(url)}">${t.open} →</a>`);
  lines.push(`<i>${t.disclaimer}</i>`);
  return lines.join("\n");
}

/**
 * Points the bot at this site: webhook with the secret header, the command
 * menu, and its @username saved for the "Connect Telegram" links.
 */
export async function connectBot(origin: string): Promise<{ username: string; webhookUrl: string }> {
  const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
  const webhookUrl = `${origin}/api/telegram`;
  const me = await tg<{ username?: string }>("getMe");
  await tg("setWebhook", { url: webhookUrl, secret_token: webhookSecret(), allowed_updates: ["message"], drop_pending_updates: true });
  await tg("setMyCommands", { commands: BOT_COMMANDS });
  const username = me.username ?? "";
  await store.setSettings(await getSql(), { "telegram:bot_username": username, "telegram:webhook_url": webhookUrl });
  return { username, webhookUrl };
}

/** The bot's webhook as last saved, to tell whether it still points here. */
export async function savedWebhook(): Promise<string | null> {
  const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
  const saved = await store.getSettings(await getSql(), ["telegram:webhook_url"]);
  return saved["telegram:webhook_url"] ?? null;
}
