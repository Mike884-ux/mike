/**
 * Background work of a long-running server (Render) — **server-only**:
 * connects the Telegram bot by itself, checks alerts every few minutes, and
 * keeps a free Render instance awake. No outside cron needed.
 */

const DEFAULT_INTERVAL_MS = 5 * 60_000;
const FIRST_RUN_DELAY_MS = 20_000;

let started = false;

const env = (name: string) => process.env[name]?.trim() ?? "";

/** Only on a server that keeps running between requests — not on serverless hosts. */
export function schedulerEnabled(): boolean {
  const flag = env("ALERTS_SCHEDULER").toLowerCase();
  if (flag === "off" || flag === "0" || flag === "false") return false;
  return flag === "on" || flag === "1" || flag === "true" || Boolean(env("RENDER"));
}

/** The address links and the webhook point to: the owner's domain, else Render's own. */
function siteOrigin(): string | null {
  const host = env("CANONICAL_HOST").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (host) return `https://${host}`;
  const own = env("RENDER_EXTERNAL_URL").replace(/\/+$/, "");
  return own || null;
}

function intervalMs(): number {
  const n = Number(env("ALERTS_INTERVAL_MS"));
  return Number.isFinite(n) && n >= 1_000 ? n : DEFAULT_INTERVAL_MS;
}

const safely = (label: string, job: () => Promise<void>) =>
  job().catch((err) => console.error(`[scheduler] ${label} failed:`, err instanceof Error ? err.message : err));

/** After a deploy or a new token: point the bot at this site unless it already is. */
let connecting: Promise<void> | null = null;

function connectIfNeeded(origin: string): Promise<void> {
  connecting ??= connectOnce(origin).finally(() => (connecting = null));
  return connecting;
}

async function connectOnce(origin: string): Promise<void> {
  const tg = await import("./telegram.server");
  if (!tg.botToken()) return;
  if ((await tg.savedWebhook()) === `${origin}/api/telegram`) return;
  const { username } = await tg.connectBot(origin);
  console.log(`[scheduler] Telegram bot @${username} connected → ${origin}/api/telegram`);
}

async function tick(origin: string): Promise<void> {
  const tg = await import("./telegram.server");
  if (tg.botToken()) {
    // Retried every round, so a failed first try or a new token heals by itself.
    await safely("telegram connect", () => connectIfNeeded(origin));
    const { runAlerts } = await import("./alerts-engine.server");
    const result = await runAlerts(origin);
    if (result.sent || result.failed) console.log(`[scheduler] alerts: ${JSON.stringify(result)}`);
  }
}

/**
 * A request through the public address counts as traffic, so the free plan
 * doesn't put the server to sleep and alerts keep being checked.
 */
async function keepAwake(): Promise<void> {
  const own = env("RENDER_EXTERNAL_URL").replace(/\/+$/, "");
  if (!own) return;
  await fetch(`${own}/api/health`, { signal: AbortSignal.timeout(20_000) }).catch(() => undefined);
}

/** Starts the loop once per process; later calls do nothing. */
export function ensureScheduler(): void {
  if (started || !schedulerEnabled()) return;
  started = true;
  const origin = siteOrigin();
  if (!origin) {
    console.warn("[scheduler] no RENDER_EXTERNAL_URL or CANONICAL_HOST — alerts are checked only through /api/cron/alerts");
    return;
  }
  const every = intervalMs();
  const first = setTimeout(() => {
    void safely("alerts", () => tick(origin));
  }, Math.min(FIRST_RUN_DELAY_MS, every));
  first.unref?.();
  const loop = setInterval(() => {
    void safely("alerts", () => tick(origin));
    void safely("keep-awake", keepAwake);
  }, every);
  loop.unref?.();
  console.log(`[scheduler] started: alerts every ${Math.round(every / 1000)} s`);
}
