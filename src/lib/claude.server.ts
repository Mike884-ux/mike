/**
 * Claude backend via the official Anthropic SDK — **server-only**.
 *
 * Model: ANTHROPIC_MODEL, default `claude-opus-5`. Set it to `claude-haiku-4-5`
 * in the hosting env for a much cheaper (and less thorough) assistant.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { AiFailure, AiJsonResult, AiRequest, AiTextResult } from "./ai.server";

const DEFAULT_MODEL = "claude-opus-5";

function model(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Haiku 4.5 predates adaptive thinking and the `effort` setting (sending
 * effort there is a 400), and server-side refusal fallbacks are documented for
 * Opus 5 / Fable 5.1. Every other current model takes effort.
 */
function capabilities(id: string) {
  const legacy = id.startsWith("claude-haiku-4-5");
  return {
    effort: !legacy,
    fallbacks: id === "claude-opus-5" || id === "claude-fable-5-1",
  };
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // Long timeout: with thinking on, a thorough chart analysis can take a while.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 1 });
  return client;
}

function baseParams(req: AiRequest) {
  const id = model();
  const caps = capabilities(id);
  return {
    model: id,
    max_tokens: req.maxTokens ?? 8000,
    system: req.system,
    messages: req.messages.map((m) => ({ role: m.role, content: m.text })),
    ...(caps.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    ...(caps.effort ? { output_config: { effort: req.effort ?? "medium" } } : {}),
  };
}

/** Map SDK errors to a reason the UI can explain. Most specific first. */
function failureOf(error: unknown): AiFailure {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return "bad_key";
  if (error instanceof Anthropic.RateLimitError) return "rate_limited";
  if (error instanceof Anthropic.BadRequestError) {
    // The API reports an empty balance as a 400; its message is the only signal.
    return /credit balance/i.test(error.message) ? "no_credit" : "unavailable";
  }
  return "unavailable";
}

function logFailure(error: unknown, reason: AiFailure) {
  const status = error instanceof Anthropic.APIError ? error.status : undefined;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[claude] ${reason}${status ? ` HTTP ${status}` : ""}: ${message.slice(0, 300)}`);
}

export async function claudeText(req: AiRequest): Promise<AiTextResult> {
  try {
    const response = await getClient().beta.messages.create(baseParams(req));
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    if (!text) {
      console.error(`[claude] empty answer, stop_reason=${response.stop_reason}`);
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, text };
  } catch (error) {
    const reason = failureOf(error);
    logFailure(error, reason);
    return { ok: false, reason };
  }
}

export async function claudeJson<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiJsonResult<T>> {
  try {
    const params = baseParams(req);
    const response = await getClient().beta.messages.parse({
      ...params,
      output_config: { ...(params.output_config ?? {}), format: betaZodOutputFormat(schema) },
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const value = response.parsed_output;
    if (value == null) {
      console.error(`[claude] structured output missing, stop_reason=${response.stop_reason}`);
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, value: value as T };
  } catch (error) {
    const reason = failureOf(error);
    logFailure(error, reason);
    return { ok: false, reason };
  }
}
