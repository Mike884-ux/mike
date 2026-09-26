/** A friend's invite code from `?ref=` — kept in this browser until the visitor signs up. */
const KEY = "scan-ref";

export function rememberReferral(search: string) {
  try {
    const code = new URLSearchParams(search)
      .get("ref")
      ?.replace(/[^a-z0-9]/gi, "")
      .slice(0, 16);
    if (code && !localStorage.getItem(KEY)) localStorage.setItem(KEY, code.toLowerCase());
  } catch {
    /* storage unavailable */
  }
}

export function pendingReferral(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearReferral() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
