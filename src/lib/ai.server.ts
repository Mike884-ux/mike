import type { GeminiOptions } from "./gemini.server";

/** Gemini first (free); Claude as fallback when Gemini is rate-limited or down. */
export async function completeAi(options: GeminiOptions): Promise<string | null> {
  const { completeGemini } = await import("./gemini.server");
  const primary = await completeGemini(options);
  if (primary) return primary;

  const { completeClaude } = await import("./claude.server");
  return completeClaude(options);
}
