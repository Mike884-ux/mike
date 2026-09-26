import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CountryId, Lang } from "./lang";

export type Theme = "light" | "dark";

type SettingsState = {
  lang: Lang;
  country: CountryId;
  theme: Theme;
  /** Home page highlight cards shown above the table. */
  highlights: boolean;
  setLang: (lang: Lang) => void;
  setCountry: (country: CountryId) => void;
  setTheme: (theme: Theme) => void;
  setHighlights: (on: boolean) => void;
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
      theme: "light",
      highlights: true,
      setLang: (lang) => set({ lang }),
      setCountry: (country) => set({ country }),
      setTheme: (theme) => set({ theme }),
      setHighlights: (highlights) => set({ highlights }),
    }),
    { name: SETTINGS_KEY },
  ),
);

/**
 * Runs in <head> before the first paint, so a dark-theme visitor never sees a
 * white flash while the app loads.
 */
export const THEME_BOOT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("${SETTINGS_KEY}")||"{}").state||{};document.documentElement.dataset.theme=s.theme==="dark"?"dark":"light";if(s.lang)document.documentElement.lang=s.lang}catch(e){}`;
