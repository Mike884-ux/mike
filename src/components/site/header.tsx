import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bot, Coins, Crown, LineChart, Menu, Newspaper, Search, Sparkles, Wallet, X } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useBilling } from "@/lib/use-billing";
import { useHydrated } from "@/lib/use-hydrated";
import { useT, type MessageKey } from "@/lib/i18n";
import { LANGS } from "@/lib/lang";
import { useSettings } from "@/lib/settings-store";
import { cn } from "@/lib/utils";
import { Mark } from "@/components/mark";
import { AccountMenu } from "@/components/account-menu";
import { CoinSearch } from "@/components/site/search";
import { ThemeToggle, useChangeLang } from "@/components/site/prefs";

export const NAV = [
  { to: "/", label: "nav.coins", icon: Coins, exact: true },
  { to: "/signals", label: "nav.signals", icon: LineChart, exact: false },
  { to: "/news", label: "nav.news", icon: Newspaper, exact: false },
  { to: "/portfolio", label: "nav.portfolio", icon: Wallet, exact: false },
  { to: "/ai", label: "nav.ai", icon: Bot, exact: false },
  { to: "/pricing", label: "nav.pricing", icon: Crown, exact: false },
] as const satisfies readonly { to: string; label: MessageKey; icon: unknown; exact: boolean }[];

export function Brand({ className }: { className?: string }) {
  const t = useT();
  return (
    <Link to="/" className={cn("flex shrink-0 items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40", className)}>
      <span className="bg-brand grid size-8 place-items-center rounded-[10px] shadow-[var(--shadow-glow)]">
        <Mark className="size-4.5 text-white" />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-fg">{t("app.name")}</span>
    </Link>
  );
}

/** "Get Pro" for guests and members without a paid plan. */
function ProButton({ className }: { className?: string }) {
  const t = useT();
  const { user, isPending } = useCurrentUserState();
  const billing = useBilling().data;
  const hydrated = useHydrated();
  if (!hydrated || isPending || (user && (!billing || (billing.plan !== "free" && !billing.trial)))) return null;
  return (
    <Link
      to="/pricing"
      className={cn(
        "bg-brand flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white shadow-[var(--shadow-glow)] outline-none hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <Sparkles className="size-4" />
      {t("nav.getPro")}
    </Link>
  );
}

function usePathname() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function AuthButtons({ stacked }: { stacked?: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const redirect = pathname === "/login" ? "/" : pathname;
  return (
    <div className={cn("flex gap-2", stacked ? "flex-col" : "items-center")}>
      <Link
        to="/login"
        search={{ mode: "signin", redirect }}
        className="flex h-9 items-center justify-center rounded-xl px-3.5 text-sm font-semibold text-fg outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {t("auth.signin")}
      </Link>
      <Link
        to="/login"
        search={{ mode: "signup", redirect }}
        className="flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-fg outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {t("auth.signup")}
      </Link>
    </div>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const changeLang = useChangeLang();
  const { user } = useCurrentUserState();
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  // Portal to <body>: the header's backdrop blur would otherwise trap this
  // fixed overlay inside the header's own height.
  return createPortal(
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={t("nav.menu")}>
      <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fade-up absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col gap-5 overflow-y-auto bg-bg p-5 shadow-[var(--shadow-pop)]">
        <div className="flex items-center justify-between">
          <Brand />
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                activeOptions={{ exact: item.exact }}
                activeProps={{ className: "bg-surface-2 text-fg" }}
                inactiveProps={{ className: "text-muted" }}
                className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-surface-2 hover:text-fg"
              >
                <Icon className="size-4.5" />
                {t(item.label)}
              </Link>
            );
          })}
        </nav>
        <div>
          <p className="mb-2 text-xs text-faint">{t("account.language")}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {LANGS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === lang}
                onClick={() => changeLang(item.id)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm",
                  item.id === lang ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted",
                )}
              >
                <span aria-hidden>{item.flag}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
          <span className="text-sm text-muted">{t("theme.title")}</span>
          <ThemeToggle />
        </div>
        <ProButton className="h-11 justify-center" />
        {user ? null : <AuthButtons stacked />}
      </div>
    </div>,
    document.body,
  );
}

function MobileSearch({ onClose }: { onClose: () => void }) {
  const t = useT();
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-bg/95 p-4 backdrop-blur-md md:hidden" role="dialog" aria-modal="true" aria-label={t("search.placeholder")}>
      <div className="flex items-center gap-2">
        <CoinSearch autoFocus onDone={onClose} className="flex-1" />
        <button type="button" onClick={onClose} className="h-9 rounded-lg px-2 text-sm font-medium text-muted hover:text-fg">
          {t("common.cancel")}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function SiteHeader() {
  const t = useT();
  const { user, isPending } = useCurrentUserState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label={t("nav.menu")}>
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "text-fg after:opacity-100" }}
              inactiveProps={{ className: "text-muted after:opacity-0" }}
              className="relative flex h-16 items-center px-3 text-sm font-semibold outline-none transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:transition-opacity hover:text-fg focus-visible:text-fg"
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <CoinSearch className="hidden w-64 md:block xl:w-72" />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={t("search.placeholder")}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg md:hidden"
          >
            <Search className="size-4.5" />
          </button>
          <ThemeToggle className="hidden sm:grid lg:hidden" />
          <ProButton className="hidden sm:flex" />
          {isPending ? (
            <span className="skeleton h-9 w-24" />
          ) : user ? (
            <AccountMenu />
          ) : (
            <div className="hidden sm:block">
              <AuthButtons />
            </div>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("nav.menu")}
            aria-expanded={menuOpen}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>
      {menuOpen ? <MobileMenu onClose={closeMenu} /> : null}
      {searchOpen ? <MobileSearch onClose={closeSearch} /> : null}
    </header>
  );
}
