import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { AiFailureReason } from "./coin-detail";
import { factorTextRu } from "./indicators";
import { asLang } from "./lang";
import { assetOf, detectBasesInText } from "./markets";
import { allow } from "./rate-limit";

export type ChatMessage = { role: "user" | "assistant"; text: string };

const SYSTEM = `You are the AI assistant inside a crypto and stock market scanner.
Talk like an experienced, calm trader who explains clearly. You may discuss strategies, risk management, market structure and specific coins or stocks.
When live data about an asset is attached, base your answer on those numbers and cite them.
Think before answering: consider the bull case, the bear case and what would change your mind.
Structure longer answers with short paragraphs or simple dashes; no markdown headings or bold.
Default length 4–8 sentences unless the user asks for more or less.
Never guarantee results or say something "will definitely" rise or fall — speak in probabilities and risks. This is not financial advice.`;

export const chatWithAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { messages?: ChatMessage[]; lang?: string; focus?: string; focusName?: string }) => ({
    messages: Array.isArray(input.messages)
      ? input.messages.slice(-16).map((m) => ({
          role: (m?.role === "assistant" ? "assistant" : "user") as ChatMessage["role"],
          text: String(m?.text ?? "").slice(0, 3000),
        }))
      : [],
    lang: asLang(input.lang),
    // The coin on screen when the question comes from the floating assistant.
    focus: /^[A-Za-z0-9]{1,15}$/.test(String(input.focus ?? "")) ? String(input.focus).toUpperCase() : null,
    focusName: String(input.focusName ?? "").replace(/[^\p{L}\p{N} .()-]/gu, "").slice(0, 60),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true; text: string } | { ok: false; reason: AiFailureReason }> => {
    // The conversation must start with the user and end with a user question.
    const firstUser = data.messages.findIndex((m) => m.role === "user");
    const messages = firstUser >= 0 ? data.messages.slice(firstUser).filter((m) => m.text.trim()) : [];
    if (!messages.length || messages.at(-1)!.role !== "user") return { ok: false, reason: "no_data" };
    if (!allow(context.userId, "ai-chat", 20, 180_000)) return { ok: false, reason: "too_often" };
    const { withAiQuota } = await import("./quota.server");
    return withAiQuota(context, "chat", async (plan, tier) => {
      // Attach live numbers for the assets the question names ("ETH или SOL?"), else the coin on screen.
      const named = detectBasesInText(messages.at(-1)!.text, 2);
      const bases = named.length ? named : data.focus && assetOf(data.focus) ? [data.focus] : [];
      const { loadCoinContext } = await import("./coin-context.server");
      const reads = await Promise.all(bases.map((b) => loadCoinContext(b, "4h").catch(() => null)));
      const liveParts = reads.flatMap((ctx) => {
        if (!ctx) return [];
        const t = ctx.technicals;
        return [
          [
            `Live data for ${ctx.base} (4h candles): price ${ctx.price}, 24h ${ctx.change24h.toFixed(2)}%.`,
            `Trend ${t.trend}, RSI ${t.rsi}, ADX ${t.adx}, MACD ${t.macd > t.macdSignal ? "above" : "below"} signal, volume ${t.volumeRatio}x average, ATR ${t.atrPct}%.`,
            `Indicator score ${ctx.score} → ${ctx.signal}; ${ctx.factors.slice(0, 4).map(factorTextRu).join("; ")}.`,
            ctx.higherTf ? `Daily trend: ${ctx.higherTf.trend}.` : "",
            ctx.backtest.trades ? `Indicator signals on this asset worked ${ctx.backtest.hitRate}% of the time (${ctx.backtest.trades} signals).` : "",
          ]
            .filter(Boolean)
            .join(" "),
        ];
      });
      // A market-wide question ("что растёт?", "страх или жадность?") gets today's market picture instead.
      if (!bases.length) liveParts.push(await marketSnapshot());
      const live = liveParts.filter(Boolean).join("\n");

      const { completeText } = await import("./ai.server");
      const focusNote = data.focus
        ? `The user is looking at ${data.focusName ? `${data.focusName} (${data.focus})` : data.focus} on the site right now. Unless they name another asset, their question is about it. When they ask for advice, give the complete picture: a clear call (buy, hold, sell or wait), why, an entry zone, a stop, one or two targets, the main risks and the time horizon — with numbers from the live data.`
        : "";
      const result = await completeText({
        system: [SYSTEM, focusNote, live].filter(Boolean).join("\n\n"),
        messages,
        // Whale (stored as "max") members get the deeper-thinking mode.
        effort: plan === "max" ? "high" : "medium",
        maxTokens: 8000,
        lang: data.lang,
        tier,
      });
      return result.ok ? { ok: true, text: result.text } : { ok: false, reason: result.reason };
    });
  });

/** Fear & Greed, BTC dominance and the day's biggest movers among the top 100 — for market-wide questions. */
async function marketSnapshot(): Promise<string> {
  const coins = await import("./coins.server");
  const [global, listing] = await Promise.all([coins.getGlobal().catch(() => null), coins.getListing(1).catch(() => null)]);
  const top = (listing?.coins ?? []).filter((c) => typeof c.change24h === "number");
  const byMove = [...top].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  const fmt = (c: (typeof top)[number]) => `${c.symbol} ${c.change24h! >= 0 ? "+" : ""}${c.change24h!.toFixed(1)}% (price ${c.price})`;
  const btc = top.find((c) => c.symbol.toUpperCase() === "BTC");
  const eth = top.find((c) => c.symbol.toUpperCase() === "ETH");
  return [
    "Market right now:",
    global?.fearGreed ? `Fear & Greed ${global.fearGreed.value} (${global.fearGreed.label}).` : "",
    global?.btcDominance ? `BTC dominance ${global.btcDominance.toFixed(1)}%.` : "",
    global?.marketCapChange24h != null ? `Total market cap 24h ${global.marketCapChange24h.toFixed(2)}%.` : "",
    btc ? `BTC ${fmt(btc)}.` : "",
    eth ? `ETH ${fmt(eth)}.` : "",
    byMove.length ? `Top gainers (top-100): ${byMove.slice(0, 5).map(fmt).join(", ")}.` : "",
    byMove.length ? `Top losers (top-100): ${byMove.slice(-5).reverse().map(fmt).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
