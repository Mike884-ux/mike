/** Gemini backend (free tier) — **server-only**. Used when Claude is absent or failing. */
import type { z } from "zod";
import type { AiFailure, AiJsonResult, AiRequest, AiTextResult } from "./ai.server";

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

type Call = { text: string | null; failure?: AiFailure; retryable: boolean };

async function callGemini(req: AiRequest, json: boolean, apiKey: string): Promise<Call> {
  const payload = {
    system_instruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] })),
    generationConfig: {
      maxOutputTokens: Math.min(req.maxTokens ?? 4000, 8000),
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[gemini] HTTP ${res.status}: ${detail.slice(0, 300)}`);
      const failure: AiFailure =
        res.status === 401 || res.status === 403 ? "bad_key" : res.status === 429 ? "rate_limited" : "unavailable";
      return { text: null, failure, retryable: res.status === 429 || res.status === 503 };
    }
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!text) console.error(`[gemini] empty text, finishReason=${body.candidates?.[0]?.finishReason}`);
    return { text: text || null, failure: text ? undefined : "unavailable", retryable: false };
  } catch (err) {
    console.error("[gemini] request failed:", err instanceof Error ? err.message : err);
    return { text: null, failure: "unavailable", retryable: true };
  }
}

async function run(req: AiRequest, json: boolean): Promise<Call> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { text: null, failure: "no_key", retryable: false };
  const first = await callGemini(req, json, apiKey);
  if (first.text || !first.retryable) return first;
  await new Promise((resolve) => setTimeout(resolve, 800));
  return callGemini(req, json, apiKey);
}

export async function geminiText(req: AiRequest): Promise<AiTextResult> {
  const call = await run(req, false);
  return call.text ? { ok: true, text: call.text } : { ok: false, reason: call.failure ?? "unavailable" };
}

export async function geminiJson<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiJsonResult<T>> {
  const call = await run(req, true);
  if (!call.text) return { ok: false, reason: call.failure ?? "unavailable" };
  const raw = call.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success) return { ok: true, value: parsed.data };
    console.error("[gemini] JSON did not match schema:", parsed.error.message.slice(0, 300));
  } catch {
    console.error("[gemini] invalid JSON:", raw.slice(0, 200));
  }
  return { ok: false, reason: "unavailable" };
}
