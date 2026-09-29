import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { AiFailureReason } from "./coin-detail";
import { factorTextRu } from "./indicators";
import { asLang } from "./lang";
import { assetOf, detectBaseInText } from "./markets";
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
      // Attach live numbers when the question names an asset ("что с солана?").
      const named = detectBaseInText(messages.at(-1)!.text);
      const base = named ?? (data.focus && assetOf(data.focus) ? data.focus : null);
      let live = "";
      if (base) {
        const { loadCoinContext } = await import("./coin-context.server");
        const ctx = await loadCoinContext(base, "4h").catch(() => null);
        if (ctx) {
          const t = ctx.technicals;
          live = [
            `Live data for ${ctx.base} (4h candles): price ${ctx.price}, 24h ${ctx.change24h.toFixed(2)}%.`,
            `Trend ${t.trend}, RSI ${t.rsi}, ADX ${t.adx}, MACD ${t.macd > t.macdSignal ? "above" : "below"} signal, volume ${t.volumeRatio}x average, ATR ${t.atrPct}%.`,
            `Indicator score ${ctx.score} → ${ctx.signal}; ${ctx.factors.slice(0, 4).map(factorTextRu).join("; ")}.`,
            ctx.higherTf ? `Daily trend: ${ctx.higherTf.trend}.` : "",
            ctx.backtest.trades ? `Indicator signals on this asset worked ${ctx.backtest.hitRate}% of the time (${ctx.backtest.trades} signals).` : "",
          ]
            .filter(Boolean)
            .join(" ");
        }
      }

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
