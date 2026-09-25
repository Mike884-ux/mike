/**
 * One entry point for every AI call on the site — **server-only**.
 *
 * Claude answers first: through the owner's ANTHROPIC_API_KEY when set, else
 * through Vercel AI Gateway, which on Vercel needs no key at all (the
 * deployment's OIDC token authenticates it). Gemini is the last fallback. Failures come back as a typed reason
 * instead of `null`, so the UI can say "add a key" or "top up credits" rather
 * than a generic "AI didn't answer".
 */
import type { z } from "zod";
import { AI_LANGUAGE, type Lang } from "./lang";

export type AiFailure =
  | "no_key"
  | "bad_key"
  | "no_credit"
  | "gateway_setup"
  | "rate_limited"
  | "refused"
  | "unavailable";

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

/** Failures worth retrying on the next provider (key/credit problems are provider-specific too). */
const TRY_NEXT: ReadonlySet<AiFailure> = new Set(["bad_key", "no_credit", "rate_limited", "unavailable", "gateway_setup"]);

type Attempt<R> = () => Promise<R>;

/**
 * Providers in order of preference: the owner's own Anthropic key, then Vercel
 * AI Gateway (needs no key on Vercel), then Gemini.
 */
async function providers<R>(
  claude: (route: "direct" | "gateway") => Promise<R>,
  gemini: () => Promise<R>,
): Promise<Attempt<R>[]> {
  const { hasDirectKey, hasGateway } = await import("./claude.server");
  const list: Attempt<R>[] = [];
  if (hasDirectKey()) list.push(() => claude("direct"));
  if (await hasGateway()) list.push(() => claude("gateway"));
  if (process.env.GEMINI_API_KEY?.trim()) list.push(gemini);
  return list;
}

async function firstAnswer<R extends { ok: true } | { ok: false; reason: AiFailure }>(attempts: Attempt<R>[]): Promise<R | { ok: false; reason: AiFailure }> {
  if (attempts.length === 0) {
    console.error("[ai] no AI backend — not on Vercel and no ANTHROPIC_API_KEY / AI_GATEWAY_API_KEY / GEMINI_API_KEY");
    return { ok: false, reason: "no_key" };
  }
  const failures: AiFailure[] = [];
  for (const attempt of attempts) {
    const result = await attempt();
    if (result.ok) return result;
    failures.push(result.reason);
    if (!TRY_NEXT.has(result.reason)) break;
  }
  // The gateway setup hint is the one the owner can act on in a click, so it wins.
  const reason = failures.includes("gateway_setup") ? "gateway_setup" : failures[0];
  return { ok: false, reason };
}

export async function completeText(req: AiRequest): Promise<AiTextResult> {
  const request = { ...req, system: withLanguage(req.system, req.lang) };
  const { claudeText } = await import("./claude.server");
  const { geminiText } = await import("./gemini.server");
  return firstAnswer(await providers((route) => claudeText(route, request), () => geminiText(request)));
}

export async function completeJson<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiJsonResult<T>> {
  const request = { ...req, system: withLanguage(req.system, req.lang) };
  const { claudeJson } = await import("./claude.server");
  const { geminiJson } = await import("./gemini.server");
  return firstAnswer(await providers((route) => claudeJson(route, request, schema), () => geminiJson(request, schema)));
}
