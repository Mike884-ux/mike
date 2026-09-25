export type GeminiOptions = {
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
};

const MODEL = "gemini-3.6-flash";

async function callGemini(options: GeminiOptions, apiKey: string): Promise<{ text: string | null; retryable: boolean }> {
  const payload: Record<string, unknown> = {
    system_instruction: { parts: [{ text: options.system }] },
    contents: [{ role: "user", parts: [{ text: options.user }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.25,
      maxOutputTokens: Math.min(options.maxTokens ?? 520, 2500),
      ...(options.json ? { responseMimeType: "application/json" } : {}),
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[gemini] HTTP ${res.status}: ${detail.slice(0, 500)}`);
      // 429/503 are Google's own "temporary, try again" signals — worth one retry.
      return { text: null, retryable: res.status === 429 || res.status === 503 };
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const text = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      console.error(
        `[gemini] empty text, finishReason=${body.candidates?.[0]?.finishReason}, raw=${JSON.stringify(body).slice(0, 500)}`,
      );
    }
    return { text: text || null, retryable: false };
  } catch (err) {
    console.error("[gemini] request failed:", err instanceof Error ? err.message : err);
    // A timeout/network hiccup is also worth one retry.
    return { text: null, retryable: true };
  }
}

export async function completeGemini(options: GeminiOptions): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const first = await callGemini(options, apiKey);
  if (first.text || !first.retryable) return first.text;

  await new Promise((resolve) => setTimeout(resolve, 800));
  const second = await callGemini(options, apiKey);
  return second.text;
}
