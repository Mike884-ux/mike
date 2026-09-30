/**
 * Outgoing email — **server-only**, over plain HTTP APIs (no SDKs):
 * - Brevo (BREVO_API_KEY): free, and works without an own domain — MAIL_FROM is
 *   a sender address confirmed in Brevo (e.g. a Gmail box), so codes reach anyone.
 * - Resend (RESEND_API_KEY): reaches everyone only with MAIL_FROM on a domain
 *   verified in Resend; its test sender delivers to the account owner alone.
 */
const MAIL_FROM = process.env.MAIL_FROM?.trim();
// Brevo only sends from a sender confirmed in it, so it needs MAIL_FROM.
const BREVO_KEY = MAIL_FROM ? process.env.BREVO_API_KEY?.trim() : undefined;
const RESEND_KEY = process.env.RESEND_API_KEY?.trim();
const FROM = MAIL_FROM || "Скан <onboarding@resend.dev>";

/** True when the site can send email at all (the code-by-email login is offered only then). */
export function mailEnabled(): boolean {
  return Boolean(BREVO_KEY || RESEND_KEY);
}

/**
 * New email+password accounts must confirm a code sent to their inbox — only
 * when mail can reach everyone, or requiring codes would lock sign-ups out.
 * EMAIL_VERIFICATION=on/off overrides.
 */
export function emailVerificationRequired(): boolean {
  const flag = process.env.EMAIL_VERIFICATION?.trim().toLowerCase();
  if (!mailEnabled() || flag === "off") return false;
  if (flag === "on") return true;
  return Boolean(MAIL_FROM);
}

/** "Скан <a@b.c>" → name and address; a bare address has no name. */
export function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1]!.replace(/^"|"$/g, "") || "Скан", email: m[2]!.trim() } : { name: "Скан", email: from.trim() };
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const res = BREVO_KEY
    ? await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sender: parseFrom(FROM), to: [{ email: to }], subject, textContent: text }),
        signal: AbortSignal.timeout(10_000),
      })
    : RESEND_KEY
      ? await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: [to], subject, text }),
          signal: AbortSignal.timeout(10_000),
        })
      : null;
  if (!res) throw new Error("no mail service is set up (BREVO_API_KEY or RESEND_API_KEY)");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[mail] ${BREVO_KEY ? "brevo" : "resend"} HTTP ${res.status}: ${detail.slice(0, 300)}`);
    throw new Error(`mail ${res.status}`);
  }
}
