/** Supported interface languages. Shared by server and client; no app imports. */
export const LANGS = [
  { id: "ru", label: "Русский", flag: "🇷🇺" },
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "tg", label: "Тоҷикӣ", flag: "🇹🇯" },
  { id: "uz", label: "Oʻzbekcha", flag: "🇺🇿" },
] as const;

export type Lang = (typeof LANGS)[number]["id"];

export function asLang(value: unknown): Lang {
  return LANGS.some((l) => l.id === value) ? (value as Lang) : "ru";
}

/** How to tell the AI which language to answer in. */
export const AI_LANGUAGE: Record<Lang, string> = {
  ru: "Russian",
  en: "English",
  tg: "Tajik (тоҷикӣ, Cyrillic script)",
  uz: "Uzbek (oʻzbekcha, Latin script)",
};

export const COUNTRIES = [
  { id: "TJ", flag: "🇹🇯", ru: "Таджикистан", en: "Tajikistan" },
  { id: "UZ", flag: "🇺🇿", ru: "Узбекистан", en: "Uzbekistan" },
  { id: "KZ", flag: "🇰🇿", ru: "Казахстан", en: "Kazakhstan" },
  { id: "KG", flag: "🇰🇬", ru: "Кыргызстан", en: "Kyrgyzstan" },
  { id: "RU", flag: "🇷🇺", ru: "Россия", en: "Russia" },
  { id: "UA", flag: "🇺🇦", ru: "Украина", en: "Ukraine" },
  { id: "BY", flag: "🇧🇾", ru: "Беларусь", en: "Belarus" },
  { id: "AZ", flag: "🇦🇿", ru: "Азербайджан", en: "Azerbaijan" },
  { id: "TR", flag: "🇹🇷", ru: "Турция", en: "Türkiye" },
  { id: "AE", flag: "🇦🇪", ru: "ОАЭ", en: "UAE" },
  { id: "US", flag: "🇺🇸", ru: "США", en: "United States" },
  { id: "GB", flag: "🇬🇧", ru: "Великобритания", en: "United Kingdom" },
  { id: "DE", flag: "🇩🇪", ru: "Германия", en: "Germany" },
  { id: "OTHER", flag: "🌍", ru: "Другая страна", en: "Other" },
] as const;

export type CountryId = (typeof COUNTRIES)[number]["id"];

export function asCountry(value: unknown): CountryId {
  return COUNTRIES.some((c) => c.id === value) ? (value as CountryId) : "OTHER";
}
