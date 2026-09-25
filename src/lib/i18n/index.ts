import { useCallback } from "react";
import { useSettings } from "@/lib/settings-store";
import type { Lang } from "@/lib/lang";
import { en } from "./en";
import { ru, type MessageKey } from "./ru";
import { tg } from "./tg";
import { uz } from "./uz";

export type { MessageKey };

const DICTS: Record<Lang, Record<MessageKey, string>> = { ru, en, tg, uz };

/** BCP 47 locale for dates. Tajik and Uzbek fall back to Russian/English when the browser lacks them. */
export const LOCALE: Record<Lang, string> = { ru: "ru-RU", en: "en-US", tg: "tg-TJ", uz: "uz-Latn-UZ" };

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = DICTS[lang][key] ?? ru[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

/** `t("scan.title")` in the current interface language. */
export function useT() {
  const lang = useSettings((s) => s.lang);
  return useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

/** "5 minutes ago" in the interface language, with a safe fallback for locales the browser lacks. */
export function timeAgo(lang: Lang, at: number, now = Date.now()): string {
  const diff = Math.round((at - now) / 1000);
  const abs = Math.abs(diff);
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    abs < 60 ? [diff, "second"] : abs < 3600 ? [Math.round(diff / 60), "minute"] : abs < 86400 ? [Math.round(diff / 3600), "hour"] : [Math.round(diff / 86400), "day"];
  for (const locale of [LOCALE[lang], lang === "tg" ? "ru-RU" : "en-US"]) {
    try {
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit);
    } catch {
      /* try the next locale */
    }
  }
  return new Date(at).toLocaleString();
}

export function formatDate(lang: Lang, at: number): string {
  for (const locale of [LOCALE[lang], "ru-RU"]) {
    try {
      return new Date(at).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      /* next */
    }
  }
  return new Date(at).toISOString();
}
