/**
 * The site running inside Telegram as a Mini App (the bot's "Открыть Скан"
 * button). Telegram passes the launch data in the URL hash; its SDK script
 * reads it, keeps it in sessionStorage and exposes window.Telegram.WebApp.
 */

type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand?: () => void;
  openInvoice: (url: string, callback?: (status: InvoiceStatus) => void) => void;
  openTelegramLink?: (url: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
    TelegramWebviewProxy?: unknown;
  }
}

const SDK_URL = "https://telegram.org/js/telegram-web-app.js";
const LAUNCH_KEY = "scan-tg-launch";

// Telegram puts the launch data in the URL hash of the first page only: keep
// it for the rest of the visit, before any navigation drops the hash.
if (typeof window !== "undefined" && window.location.hash.includes("tgWebAppData")) {
  try {
    sessionStorage.setItem(LAUNCH_KEY, new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData") ?? "");
  } catch {
    /* storage blocked */
  }
}

function savedLaunch(): string {
  try {
    return sessionStorage.getItem(LAUNCH_KEY) ?? "";
  } catch {
    return "";
  }
}

/** True when the page was opened from the bot inside the Telegram app. */
export function inTelegram(): boolean {
  if (typeof window === "undefined") return false;
  if (window.Telegram?.WebApp?.initData) return true;
  if (window.location.hash.includes("tgWebAppData") || savedLaunch()) return true;
  try {
    if (sessionStorage.getItem("__telegram__initParams")?.includes("tgWebAppData")) return true;
  } catch {
    /* storage blocked */
  }
  return Boolean(window.TelegramWebviewProxy);
}

let sdk: Promise<TelegramWebApp | null> | null = null;

/** Telegram's own SDK, loaded only inside Telegram; null elsewhere or when it can't load. */
export function telegramApp(): Promise<TelegramWebApp | null> {
  if (!inTelegram()) return Promise.resolve(null);
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  sdk ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      const app = window.Telegram?.WebApp ?? null;
      app?.ready();
      app?.expand?.();
      resolve(app);
    };
    script.onerror = () => {
      sdk = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return sdk;
}

/**
 * Opens a Stars invoice: as a payment sheet over the site inside Telegram, or
 * by handing the t.me link to the Telegram app from a browser ("external").
 */
export async function openStarsInvoice(url: string): Promise<InvoiceStatus | "external"> {
  const app = await telegramApp();
  if (app?.openInvoice) {
    try {
      return await new Promise((resolve) => app.openInvoice(url, (status) => resolve(status)));
    } catch (err) {
      // An older Telegram app without in-app invoices: let Telegram open the link itself.
      console.warn("[telegram] openInvoice failed:", err);
      if (app.openTelegramLink) {
        app.openTelegramLink(url);
        return "external";
      }
    }
  }
  if (inTelegram()) window.location.href = url;
  else window.open(url, "_blank", "noopener");
  return "external";
}

/** Telegram's signed launch data, from its SDK or straight from the launch URL. */
async function launchData(): Promise<string> {
  const app = await telegramApp();
  if (app?.initData) return app.initData;
  return new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData") || savedLaunch();
}

/** Signs in with the Telegram account the Mini App was opened from; true on success. */
export async function signInWithTelegram(): Promise<boolean> {
  const initData = await launchData();
  if (!initData) return false;
  const res = await fetch("/api/auth/sign-in/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ initData }),
  }).catch(() => null);
  return Boolean(res?.ok);
}
