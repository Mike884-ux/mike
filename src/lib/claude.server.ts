/**
 * Claude backend via the official Anthropic SDK — **server-only**.
 *
 * Two routes to the same models:
 * - `direct`: api.anthropic.com with ANTHROPIC_API_KEY (model: ANTHROPIC_MODEL,
 *   default `claude-opus-5`).
 * - `gateway`: Vercel AI Gateway (Anthropic-compatible endpoint). On Vercel it
 *   authenticates with the deployment's own OIDC token, so the site owner does
 *   not have to create or paste any key. AI_GATEWAY_API_KEY works too (for local
 *   runs). Model: AI_GATEWAY_MODEL, default `anthropic/claude-opus-5`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { AiFailure, AiJsonResult, AiRequest, AiTextResult } from "./ai.server";

const GATEWAY_URL = process.env.AI_GATEWAY_BASE_URL?.trim() || "https://ai-gateway.vercel.sh";

export type ClaudeRoute = "direct" | "gateway";

function directModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5";
}

function gatewayModel(): string {
  return process.env.AI_GATEWAY_MODEL?.trim() || "anthropic/claude-opus-5";
}

/** True when a direct Anthropic key is configured. */
export function hasDirectKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

type RequestContext = { get?: () => { headers?: Record<string, string | undefined> } | undefined };

/**
 * Credential for AI Gateway: an explicit key, else the Vercel OIDC token that
 * Vercel attaches to every request of a deployed function (header
 * `x-vercel-oidc-token`; `vercel env pull` puts it in VERCEL_OIDC_TOKEN locally).
 */
async function gatewayToken(): Promise<string | undefined> {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (key) return key;
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const header = getRequestHeader("x-vercel-oidc-token");
    if (header) return header;
  } catch {
    // Not inside a request (background work) — fall through.
  }
  const context = (globalThis as Record<symbol, RequestContext | undefined>)[Symbol.for("@vercel/request-context")];
  return context?.get?.()?.headers?.["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN?.trim() || undefined;
}

/** True when AI Gateway can be reached without anyone typing in a key. */
export async function hasGateway(): Promise<boolean> {
  return Boolean(await gatewayToken());
}

/**
 * Haiku 4.5 predates adaptive thinking and the `effort` setting (sending
 * effort there is a 400). Server-side refusal fallbacks are an Anthropic API
 * feature for Opus 5 / Fable 5.1, so they are only sent on the direct route.
 */
function capabilities(route: ClaudeRoute, id: string) {
  const bare = id.replace(/^anthropic\//, "");
  return {
    effort: !bare.startsWith("claude-haiku-4"),
    fallbacks: route === "direct" && (bare === "claude-opus-5" || bare === "claude-fable-5-1"),
  };
}

let directClient: Anthropic | null = null;

async function clientFor(route: ClaudeRoute): Promise<Anthropic | null> {
  if (route === "direct") {
    // Long timeout: with thinking on, a thorough chart analysis can take a while.
    directClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 1 });
    return directClient;
  }
  // The OIDC token is short-lived and per request, so the client is too.
  const token = await gatewayToken();
  if (!token) return null;
  return new Anthropic({ apiKey: token, baseURL: GATEWAY_URL, timeout: 120_000, maxRetries: 1 });
}

function baseParams(route: ClaudeRoute, req: AiRequest) {
  const id = route === "direct" ? directModel() : gatewayModel();
  const caps = capabilities(route, id);
  return {
    params: {
      model: id,
      max_tokens: req.maxTokens ?? 8000,
      system: req.system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.text })),
      ...(caps.effort ? { output_config: { effort: req.effort ?? "medium" } } : {}),
    },
    fallbacks: caps.fallbacks,
  };
}

const FALLBACK_BETA = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

/** Map SDK errors to a reason the UI can explain. Most specific first. */
function failureOf(route: ClaudeRoute, error: unknown): AiFailure {
  const message = error instanceof Error ? error.message : "";
  // Gateway problems are account setup on Vercel (not enabled / needs verifying / out of credits), not a bad key.
  if (route === "gateway") {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return "gateway_setup";
    if (error instanceof Anthropic.APIError && error.status === 402) return "gateway_setup";
    if (/credit card|verification|payment required|insufficient (funds|credits)/i.test(message)) return "gateway_setup";
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return "bad_key";
  if (error instanceof Anthropic.RateLimitError) return "rate_limited";
  if (error instanceof Anthropic.BadRequestError) {
    // The API reports an empty balance as a 400; its message is the only signal.
    return /credit balance/i.test(message) ? "no_credit" : "unavailable";
  }
  return "unavailable";
}

function logFailure(route: ClaudeRoute, error: unknown, reason: AiFailure) {
  const status = error instanceof Anthropic.APIError ? error.status : undefined;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[claude:${route}] ${reason}${status ? ` HTTP ${status}` : ""}: ${message.slice(0, 300)}`);
}

type Reply = { stop_reason: string | null; content: ReadonlyArray<{ type: string; text?: string }> };

export async function claudeText(route: ClaudeRoute, req: AiRequest): Promise<AiTextResult> {
  const client = await clientFor(route);
  if (!client) return { ok: false, reason: "no_key" };
  try {
    const { params, fallbacks } = baseParams(route, req);
    const response: Reply = fallbacks
      ? await client.beta.messages.create({ ...params, ...FALLBACK_BETA })
      : await client.messages.create(params);
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = response.content
      .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
      .join("")
      .trim();
    if (!text) {
      console.error(`[claude:${route}] empty answer, stop_reason=${response.stop_reason}`);
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, text };
  } catch (error) {
    const reason = failureOf(route, error);
    logFailure(route, error, reason);
    return { ok: false, reason };
  }
}

export async function claudeJson<T>(route: ClaudeRoute, req: AiRequest, schema: z.ZodType<T>): Promise<AiJsonResult<T>> {
  const client = await clientFor(route);
  if (!client) return { ok: false, reason: "no_key" };
  try {
    const { params, fallbacks } = baseParams(route, req);
    const outputConfig = params.output_config ?? {};
    const response = fallbacks
      ? await client.beta.messages.parse({
          ...params,
          ...FALLBACK_BETA,
          output_config: { ...outputConfig, format: betaZodOutputFormat(schema) },
        })
      : await client.messages.parse({ ...params, output_config: { ...outputConfig, format: zodOutputFormat(schema) } });
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const value = response.parsed_output;
    if (value == null) {
      console.error(`[claude:${route}] structured output missing, stop_reason=${response.stop_reason}`);
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, value: value as T };
  } catch (error) {
    const reason = failureOf(route, error);
    logFailure(route, error, reason);
    return { ok: false, reason };
  }
}
