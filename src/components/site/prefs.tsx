import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Moon, Sun } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useT } from "@/lib/i18n";
import { LANGS, type Lang } from "@/lib/lang";
import { useSettings } from "@/lib/settings-store";
import { useSaveSettings } from "@/lib/use-account";
import { cn } from "@/lib/utils";

/** Keeps <html data-theme> and <html lang> in step with the settings. */
export function useApplyPrefs() {
  const theme = useSettings((s) => s.theme);
  const lang = useSettings((s) => s.lang);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useT();
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={t(dark ? "theme.light" : "theme.dark")}
      title={t(dark ? "theme.light" : "theme.dark")}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-muted outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

/** Pick the interface language; signed-in users also get it saved to their account. */
export function useChangeLang() {
  const setLang = useSettings((s) => s.setLang);
  const country = useSettings((s) => s.country);
  const user = useCurrentUser();
  const save = useSaveSettings();
  return (lang: Lang) => {
    setLang(lang);
    if (user) save.mutate({ lang, country });
  };
}

export function LanguageMenu({ className, align = "right" }: { className?: string; align?: "left" | "right" }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const changeLang = useChangeLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0];
  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("account.language")}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span aria-hidden>{current.flag}</span>
        {current.id.toUpperCase()}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={t("account.language")}
          className={cn(
            "absolute top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl bg-surface p-1 shadow-[var(--shadow-pop)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {LANGS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === lang}
                onClick={() => {
                  changeLang(item.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-fg outline-none hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                <span aria-hidden>{item.flag}</span>
                <span className="flex-1">{item.label}</span>
                {item.id === lang ? <Check className="size-4 text-primary" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
