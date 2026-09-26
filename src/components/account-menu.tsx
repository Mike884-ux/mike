import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Globe, Laptop, LogOut, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import { authClient, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { formatDate, useT } from "@/lib/i18n";
import { COUNTRIES, LANGS, type CountryId, type Lang } from "@/lib/lang";
import { useSettings } from "@/lib/settings-store";
import { useSaveSettings } from "@/lib/use-account";
import { PlanSummary } from "@/components/billing/plan-summary";

type SessionRow = { id: string; token: string; ipAddress?: string | null; userAgent?: string | null; createdAt: string | Date };

function deviceName(ua: string | null | undefined): { label: string; mobile: boolean } {
  const s = ua ?? "";
  const mobile = /Mobile|Android|iPhone|iPad/i.test(s);
  const os = /Windows/i.test(s) ? "Windows" : /Mac OS/i.test(s) ? "macOS" : /Android/i.test(s) ? "Android" : /iPhone|iPad|iOS/i.test(s) ? "iOS" : /Linux/i.test(s) ? "Linux" : "";
  const browser = /Edg\//i.test(s) ? "Edge" : /Chrome\//i.test(s) ? "Chrome" : /Firefox\//i.test(s) ? "Firefox" : /Safari\//i.test(s) ? "Safari" : "";
  return { label: [browser, os].filter(Boolean).join(" · ") || "—", mobile };
}

export function LanguageCountryFields({ onSaved }: { onSaved?: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const country = useSettings((s) => s.country);
  const setLang = useSettings((s) => s.setLang);
  const setCountry = useSettings((s) => s.setCountry);
  const save = useSaveSettings();
  const pickLang = (id: Lang) => {
    setLang(id);
    save.mutate({ lang: id, country }, { onSuccess: onSaved });
  };
  const pickCountry = (id: CountryId) => {
    setCountry(id);
    save.mutate({ lang, country: id }, { onSuccess: onSaved });
  };
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
          <Globe className="size-3.5" />
          {t("account.language")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {LANGS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={lang === item.id}
              onClick={() => pickLang(item.id)}
              className={`flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm transition-colors ${
                lang === item.id ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-fg"
              }`}
            >
              <span aria-hidden>{item.flag}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <MapPin className="size-3.5" />
          {t("account.country")}
        </span>
        <select
          value={country}
          onChange={(event) => pickCountry(event.target.value as CountryId)}
          className="h-9 rounded-lg bg-surface-2 px-2.5 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {COUNTRIES.map((c) => (
            <option key={c.id} value={c.id} className="bg-bg">
              {c.flag} {lang === "en" ? c.en : c.ru}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Sessions() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const client = useQueryClient();
  const current = authClient.useSession().data?.session?.token;
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data } = await authClient.listSessions();
      return (data ?? []) as SessionRow[];
    },
    staleTime: 30_000,
  });
  const refresh = () => void client.invalidateQueries({ queryKey: ["sessions"] });
  const rows = sessions.data ?? [];
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="size-3.5" />
        {t("account.sessions")}
      </p>
      <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
        {rows.map((s) => {
          const device = deviceName(s.userAgent);
          const Icon = device.mobile ? Smartphone : Laptop;
          const mine = s.token === current;
          return (
            <li key={s.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-2">
              <Icon className="size-4 shrink-0 text-faint" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-fg">
                  {device.label}
                  {mine ? <span className="ml-1 text-accent">· {t("account.thisDevice")}</span> : null}
                </p>
                <p className="truncate font-mono text-[10px] text-faint">
                  {s.ipAddress || t("account.noIp")} · {formatDate(lang, new Date(s.createdAt).getTime())}
                </p>
              </div>
              {mine ? null : (
                <button
                  type="button"
                  onClick={() => void authClient.revokeSession({ token: s.token }).then(refresh)}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] text-short hover:bg-short/10"
                >
                  {t("account.revoke")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > 1 ? (
        <button
          type="button"
          onClick={() => void authClient.revokeOtherSessions().then(refresh)}
          className="mt-1.5 w-full rounded-lg px-2 py-1.5 text-xs text-short hover:bg-short/10"
        >
          {t("account.revokeOthers")}
        </button>
      ) : null}
    </div>
  );
}

export function AccountMenu() {
  const t = useT();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? t("account.menu");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("account.menu")}
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="bg-brand grid size-8 place-items-center rounded-full text-sm font-semibold text-white">
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium text-fg md:inline">{label}</span>
        <ChevronDown className={`size-3.5 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-bg/95 shadow-[var(--shadow-border)] backdrop-blur-xl">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-fg">{user.displayName ?? t("account.menu")}</p>
            {user.primaryEmail ? <p className="truncate text-xs text-faint">{user.primaryEmail}</p> : null}
          </div>
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-4">
            <PlanSummary onNavigate={() => setOpen(false)} />
            <LanguageCountryFields />
            <Sessions />
          </div>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut().catch(() => setSigningOut(false));
            }}
            className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-left text-sm text-short hover:bg-short/10 disabled:opacity-60"
          >
            <LogOut className="size-4" />
            {signingOut ? t("account.signingOut") : t("account.signOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function WelcomeModal({ onDone }: { onDone: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const country = useSettings((s) => s.country);
  const save = useSaveSettings();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t("welcome.title")}>
      <div className="fade-up w-full max-w-md rounded-3xl bg-bg/95 p-6 shadow-[var(--shadow-border)]">
        <h2 className="text-gradient font-display text-2xl font-bold">{t("welcome.title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("welcome.text")}</p>
        <div className="mt-5">
          <LanguageCountryFields />
        </div>
        <button
          type="button"
          onClick={() => {
            save.mutate({ lang, country });
            onDone();
          }}
          className="bg-brand mt-6 h-11 w-full rounded-xl text-sm font-semibold text-white shadow-[var(--shadow-glow)]"
        >
          {t("common.continue")}
        </button>
      </div>
    </div>
  );
}
