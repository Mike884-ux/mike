import type { GeminiOptions } from "./gemini.server";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

async function callClaude(options: GeminiOptions, apiKey: string): Promise<string | null> {
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: options.user }];
  // Claude has no JSON response mode — prefilling the assistant turn with "{"
  // reliably forces a JSON object instead of prose.
  if (options.json) messages.push({ role: "assistant", content: "{" });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: Math.min(options.maxTokens ?? 520, 2000),
      temperature: options.temperature ?? 0.25,
      system: options.system,
      messages,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[claude] HTTP ${res.status}: ${detail.slice(0, 500)}`);
    return null;
  }
  const body = (await res.json()) as { content?: { type?: string; text?: string }[] };
  const text = body.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();
  if (!text) return null;
  return options.json ? `{${text}` : text;
}

/** Fallback AI backend — used when Gemini's free tier is out of quota or down. */
export async function completeClaude(options: GeminiOptions): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callClaude(options, apiKey);
      if (text) return text;
    } catch (err) {
      const cause = err instanceof Error && "cause" in err ? err.cause : undefined;
      // Seen intermittently on this network: a TLS handshake to api.anthropic.com
      // occasionally comes back with an untrusted cert — a local network/ISP
      // hiccup, not something the app can fix. Retrying once clears it most times.
      console.error(
        "[claude] request failed:",
        err instanceof Error ? err.message : err,
        cause instanceof Error ? `cause: ${cause.message}` : cause ? `cause: ${JSON.stringify(cause)}` : "",
      );
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return null;
}
