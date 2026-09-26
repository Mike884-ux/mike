/**
 * Outgoing email — **server-only**. Uses Resend's HTTP API (no SDK), so the
 * only setting the owner needs is RESEND_API_KEY; MAIL_FROM is optional.
 */
const RESEND_KEY = process.env.RESEND_API_KEY?.trim();
const FROM = process.env.MAIL_FROM?.trim() || "Скан <onboarding@resend.dev>";

/** True when the site can send email at all (the code-by-email login is offered only then). */
export function mailEnabled(): boolean {
  return Boolean(RESEND_KEY);
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!RESEND_KEY) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[mail] HTTP ${res.status}: ${detail.slice(0, 300)}`);
    throw new Error(`mail ${res.status}`);
  }
}
