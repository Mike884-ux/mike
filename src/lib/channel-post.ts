/**
 * The daily market review the bot posts to the owner's Telegram channel.
 * Pure — built from market data only (no AI call, so it costs nothing);
 * shared by the poster and the tests.
 */

export type ReviewCoin = { symbol: string; price: number; change24h: number | null };
export type ReviewInput = {
  date: string; // "30.09.2026"
  majors: ReviewCoin[];
  gainers: ReviewCoin[];
  losers: ReviewCoin[];
  marketCapChange24h: number | null;
  fearGreed: { value: number; label: string } | null;
};

/** Posts go out after this local hour, once a day. */
export const CHANNEL_POST_HOUR = 9;
export const CHANNEL_TZ = "Asia/Dushanbe";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function price(value: number): string {
  const digits = value >= 1000 ? 0 : value >= 1 ? 2 : value >= 0.01 ? 4 : 8;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function change(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const arrow = value > 0.05 ? "🟢" : value < -0.05 ? "🔴" : "⚪️";
  return `${arrow} ${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

const MOOD: [number, string][] = [
  [25, "сильный страх 😱"],
  [45, "страх 😟"],
  [55, "нейтрально 😐"],
  [75, "жадность 😏"],
  [101, "сильная жадность 🤑"],
];

export function channelPostText(input: ReviewInput): string {
  const lines = [`📊 <b>Крипторынок утром — ${esc(input.date)}</b>`, ""];
  for (const coin of input.majors) lines.push(`<b>${esc(coin.symbol)}</b> ${price(coin.price)} · ${change(coin.change24h)}`);
  if (input.marketCapChange24h !== null) lines.push("", `Рынок за сутки: ${change(input.marketCapChange24h)}`);
  if (input.fearGreed) {
    const mood = MOOD.find(([top]) => input.fearGreed!.value < top)?.[1] ?? "";
    lines.push(`Индекс страха и жадности: <b>${input.fearGreed.value}</b> — ${mood}`);
  }
  if (input.gainers.length) {
    lines.push("", "🚀 <b>Лидеры роста</b>");
    for (const c of input.gainers) lines.push(`${esc(c.symbol)} ${change(c.change24h)}`);
  }
  if (input.losers.length) {
    lines.push("", "📉 <b>Лидеры падения</b>");
    for (const c of input.losers) lines.push(`${esc(c.symbol)} ${change(c.change24h)}`);
  }
  lines.push("", "🤖 Разбор любой монеты от ИИ — покупать, продавать или ждать — в боте по кнопке ниже.", "", "<i>Не является инвестиционной рекомендацией.</i>");
  return lines.join("\n");
}

/** "@name", "name", "t.me/name", "https://t.me/name" → "@name"; numeric ids ("-100…") stay as they are. */
export function normalizeChannel(value: string): string | null {
  const v = value.trim().replace(/^https?:\/\//i, "").replace(/^(t|telegram)\.me\//i, "").replace(/\/+$/, "");
  if (/^-100\d{5,}$/.test(v)) return v;
  const name = v.replace(/^@/, "");
  return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(name) ? `@${name}` : null;
}

/** The channel's local day ("2026-09-30") and hour for a moment. */
export function localDay(now: number, timeZone = CHANNEL_TZ): { day: string; hour: number; label: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(now))
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), label: `${parts.day}.${parts.month}.${parts.year}` };
}
