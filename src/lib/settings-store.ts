import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CountryId, Lang } from "./lang";

type SettingsState = {
  lang: Lang;
  country: CountryId;
  setLang: (lang: Lang) => void;
  setCountry: (country: CountryId) => void;
};

/**
 * Interface language and country on this device. Kept locally so the login
 * page already speaks the visitor's language; mirrored to the account once
 * signed in (see `use-account.ts`).
 */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: "ru",
      country: "TJ",
      setLang: (lang) => set({ lang }),
      setCountry: (country) => set({ country }),
    }),
    { name: "scan-settings" },
  ),
);
