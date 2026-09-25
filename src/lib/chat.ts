import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { allow } from "./rate-limit";

export type ChatMessage = { role: "user" | "assistant"; text: string };

export const chatWithAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { messages?: ChatMessage[] }) => ({
    messages: Array.isArray(input.messages)
      ? input.messages.slice(-12).map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as ChatMessage["role"],
          text: String(m.text ?? "").slice(0, 2000),
        }))
      : [],
  }))
  .handler(async ({ data, context }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    if (!data.messages.length) return { ok: false, error: "Пустое сообщение." };
    if (!allow(context.userId, "ai-chat", 20, 180_000)) {
      return { ok: false, error: "Слишком часто. Подожди немного." };
    }
    const { completeAi } = await import("./ai.server");
    const system =
      "Ты — дружелюбный финансовый ассистент внутри крипто/акций сканера. Отвечай по-русски, по делу, простым языком. Можно обсуждать торговые стратегии, риск-менеджмент, устройство рынка, конкретные монеты и акции. Коротко (3-6 предложений, если не просят подробнее). Никогда не гарантируй результат и не утверждай 'точно вырастет/упадёт' — только вероятностные рассуждения и разбор рисков. Если вопрос не про финансы — всё равно вежливо ответь по существу.";
    const conversation = data.messages
      .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.text}`)
      .join("\n");
    const raw = await completeAi({ system, user: conversation, json: false, maxTokens: 700, temperature: 0.5 });
    if (!raw) return { ok: false, error: "ИИ сейчас не ответил. Попробуй ещё раз." };
    return { ok: true, text: raw.trim() };
  });
