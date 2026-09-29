import { create } from "zustand";
import { persist } from "zustand/middleware";
import { asExchange, type Exchange } from "./exchanges";
import { asLang, type CountryId, type Lang } from "./lang";

export type Theme = "light" | "dark" | "system";
/** Currency the portfolio totals are shown in. */
export type Currency = "USD" | "BTC";

type SettingsState = {
  lang: Lang;
  country: CountryId;
  theme: Theme;
  currency: Currency;
  /** Home page highlight cards shown above the table. */
  highlights: boolean;
  /** The exchange this visitor uses — shown first next time. */
  exchange: Exchange | null;
  setLang: (lang: Lang) => void;
  setCountry: (country: CountryId) => void;
  setTheme: (theme: Theme) => void;
  setCurrency: (currency: Currency) => void;
  setHighlights: (on: boolean) => void;
  setExchange: (exchange: Exchange | null) => void;
};

export const SETTINGS_KEY = "scan-settings";

/**
 * Interface language, country and look on this device. Kept locally so even
 * signed-out visitors keep their choice; language and country are mirrored to
 * the account once signed in (see `use-account.ts`).
 */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: "ru",
      country: "TJ",
      theme: "dark",
      currency: "USD",
      highlights: true,
      exchange: null,
      setLang: (lang) => set({ lang }),
      setCountry: (country) => set({ country }),
      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      setHighlights: (highlights) => set({ highlights }),
      setExchange: (exchange) => set({ exchange }),
    }),
    {
      name: SETTINGS_KEY,
      // Older versions offered more languages; anything unknown falls back to Russian.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...saved,
          lang: asLang(saved.lang ?? current.lang),
          theme: saved.theme === "light" || saved.theme === "system" ? saved.theme : "dark",
          currency: saved.currency === "BTC" ? "BTC" : "USD",
          exchange: asExchange(saved.exchange),
        };
      },
    },
  ),
);

/**
 * Runs in <head> before the first paint, so a dark-theme visitor never sees a
 * white flash while the app loads.
 */
export const THEME_BOOT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("${SETTINGS_KEY}")||"{}").state||{};var d=!s.theme||s.theme==="dark"||(s.theme==="system"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";document.documentElement.lang=s.lang==="en"?"en":"ru"}catch(e){}`;
