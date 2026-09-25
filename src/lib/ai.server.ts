/**
 * One entry point for every AI call on the site — **server-only**.
 *
 * Claude is the primary backend when ANTHROPIC_API_KEY is set (the owner pays
 * for it and it reasons better); Gemini is the fallback, or the only backend
 * when just GEMINI_API_KEY is set. Failures come back as a typed reason
 * instead of `null`, so the UI can say "add a key" or "top up credits" rather
 * than a generic "AI didn't answer".
 */
import type { z } from "zod";
import { AI_LANGUAGE, type Lang } from "./lang";

export type AiFailure = "no_key" | "bad_key" | "no_credit" | "rate_limited" | "refused" | "unavailable";

export type AiMessage = { role: "user" | "assistant"; text: string };

export type AiRequest = {
  system: string;
  messages: AiMessage[];
  /** How hard the model should think. Chat: medium; chart analysis: high; rephrasing: low. */
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  lang?: Lang;
};

export type AiTextResult = { ok: true; text: string } | { ok: false; reason: AiFailure };
export type AiJsonResult<T> = { ok: true; value: T } | { ok: false; reason: AiFailure };

/** Adds the "answer in <language>" rule to a system prompt. */
export function withLanguage(system: string, lang: Lang | undefined): string {
  if (!lang) return system;
  return `${system}\n\nWrite every human-readable word of your answer in ${AI_LANGUAGE[lang]}.`;
}

/** Failures worth retrying on the other provider (key/credit problems are provider-specific too). */
const TRY_NEXT: ReadonlySet<AiFailure> = new Set(["bad_key", "no_credit", "rate_limited", "unavailable"]);

export async function completeText(req: AiRequest): Promise<AiTextResult> {
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  if (!hasClaude && !hasGemini) {
    console.error("[ai] no AI key configured — set ANTHROPIC_API_KEY or GEMINI_API_KEY");
    return { ok: false, reason: "no_key" };
  }
  const request = { ...req, system: withLanguage(req.system, req.lang) };
  let first: AiTextResult | null = null;
  if (hasClaude) {
    const { claudeText } = await import("./claude.server");
    first = await claudeText(request);
    if (first.ok || !hasGemini || !TRY_NEXT.has(first.reason)) return first;
  }
  const { geminiText } = await import("./gemini.server");
  const second = await geminiText(request);
  return second.ok || !first ? second : first;
}

export async function completeJson<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiJsonResult<T>> {
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  if (!hasClaude && !hasGemini) {
    console.error("[ai] no AI key configured — set ANTHROPIC_API_KEY or GEMINI_API_KEY");
    return { ok: false, reason: "no_key" };
  }
  const request = { ...req, system: withLanguage(req.system, req.lang) };
  let first: AiJsonResult<T> | null = null;
  if (hasClaude) {
    const { claudeJson } = await import("./claude.server");
    first = await claudeJson(request, schema);
    if (first.ok || !hasGemini || !TRY_NEXT.has(first.reason)) return first;
  }
  const { geminiJson } = await import("./gemini.server");
  const second = await geminiJson(request, schema);
  return second.ok || !first ? second : first;
}
