import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import {
  ArrowLeftRight,
  Bell,
  Bot,
  ChevronRight,
  Compass,
  Crown,
  Gift,
  LifeBuoy,
  LineChart,
  LogOut,
  Monitor,
  Moon,
  Newspaper,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Wallet,
  X,
} from "lucide-react";
import { getAccount } from "@/lib/account";
import { signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { timeAgo, useT, type MessageKey } from "@/lib/i18n";
import { COUNTRIES, LANGS, type CountryId } from "@/lib/lang";
import { getNews } from "@/lib/news";
import { PLAN_LABEL } from "@/lib/plans";
import { useSettings, type Currency, type Theme } from "@/lib/settings-store";
import { ACCOUNT_KEY, useSaveSettings } from "@/lib/use-account";
import { useBilling, useSiteStatus } from "@/lib/use-billing";
import { getPrices } from "@/lib/wallet";
import { cn, formatPct, formatUsd } from "@/lib/utils";
import { PlanSummary } from "@/components/billing/plan-summary";
import { Sessions } from "@/components/account-menu";
import { useChangeLang } from "@/components/site/prefs";

/** Open / close the profile drawer from anywhere (header avatar, bottom tab bar). */
export const useProfileDrawer = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

const BTC_SYMBOL = "BTCUSDT";

function formatBtc(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  return `${value < 0 ? "-" : ""}₿${abs.toFixed(digits)}`;
}

/** The member's holdings valued now: total, P/L against entry and the 24h move, in USD or BTC. */
function usePortfolioSummary(enabled: boolean) {
  const account = useQuery({ queryKey: ACCOUNT_KEY, queryFn: () => getAccount(), staleTime: 30_000, enabled });
  const positions = useMemo(() => account.data?.positions ?? [], [account.data]);
  const symbols = useMemo(() => [...new Set([...positions.map((p) => p.symbol), BTC_SYMBOL])], [positions]);
  const prices = useQuery({
    queryKey: ["drawer-prices", symbols.join(",")],
    queryFn: () => getPrices({ data: { symbols } }),
    enabled: enabled && account.isSuccess,
    staleTime: 20_000,
    refetchInterval: enabled ? 30_000 : false,
  });
  return useMemo(() => {
    const bySymbol = new Map((prices.data ?? []).map((row) => [row.symbol, row]));
    const rows = positions.map((p) => {
      const live = bySymbol.get(p.symbol);
      const now = live?.price || p.entry;
      const change = live?.change24h ?? 0;
      const value = now * p.qty;
      return { base: p.base, value, cost: p.entry * p.qty, dayChange: value - value / (1 + change / 100) };
    });
    const total = rows.reduce((s, r) => s + r.value, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const day = rows.reduce((s, r) => s + r.dayChange, 0);
    return {
      loading: account.isLoading || (positions.length > 0 && prices.isLoading),
      count: rows.length,
      total,
      pnl: total - cost,
      pnlPct: cost > 0 ? ((total - cost) / cost) * 100 : 0,
      day,
      dayPct: total - day > 0 ? (day / (total - day)) * 100 : 0,
      btcPrice: bySymbol.get(BTC_SYMBOL)?.price ?? null,
      top: [...rows].sort((a, b) => b.value - a.value).slice(0, 3),
    };
  }, [account.isLoading, positions, prices.data, prices.isLoading]);
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors",
            value === o.id ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl bg-surface shadow-[var(--shadow-border)]", className)}>{children}</div>;
}

function Row({ icon, label, onClick, to, href, hash, danger, children }: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  to?: string;
  href?: string;
  hash?: string;
  danger?: boolean;
  children?: ReactNode;
}) {
  const hide = useProfileDrawer((s) => s.hide);
  const cls = cn(
    "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium outline-none hover:bg-surface-2 focus-visible:bg-surface-2",
    danger ? "text-short" : "text-fg",
  );
  const inner = (
    <>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", danger ? "bg-short/10" : "bg-surface-2")}>{icon}</span>
      <span className="flex-1">{label}</span>
      {children ?? (danger ? null : <ChevronRight className="size-4 text-faint" />)}
    </>
  );
  if (to) {
    return (
      <Link to={to} hash={hash} onClick={hide} className={cls}>
        {inner}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

const ACTIONS: { to: string; search?: Record<string, string>; hash?: string; label: MessageKey; icon: typeof Bot; tone: string }[] = [
  { to: "/signals", label: "drawer.a.signals", icon: LineChart, tone: "from-emerald-400 to-teal-600" },
  { to: "/screener", label: "drawer.a.screener", icon: SlidersHorizontal, tone: "from-cyan-400 to-sky-600" },
  { to: "/alerts", label: "drawer.a.alerts", icon: Bell, tone: "from-orange-400 to-red-500" },
  { to: "/ai", label: "drawer.a.ai", icon: Bot, tone: "from-indigo-400 to-violet-600" },
  { to: "/ai", search: { tab: "strategy" }, label: "drawer.a.strategy", icon: Compass, tone: "from-sky-400 to-blue-600" },
  { to: "/converter", label: "drawer.a.converter", icon: ArrowLeftRight, tone: "from-amber-300 to-orange-500" },
  { to: "/pricing", hash: "invite", label: "drawer.a.invite", icon: Gift, tone: "from-pink-400 to-rose-600" },
  { to: "/pricing", label: "drawer.a.pro", icon: Crown, tone: "from-yellow-300 to-amber-600" },
];

function contactHref(contact: string): string {
  if (/^https?:\/\//.test(contact)) return contact;
  if (contact.startsWith("@")) return `https://t.me/${contact.slice(1)}`;
  if (contact.includes("@")) return `mailto:${contact}`;
  return contact;
}

function DrawerBody() {
  const t = useT();
  const user = useCurrentUser();
  const hide = useProfileDrawer((s) => s.hide);
  const lang = useSettings((s) => s.lang);
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const currency = useSettings((s) => s.currency);
  const setCurrency = useSettings((s) => s.setCurrency);
  const country = useSettings((s) => s.country);
  const setCountry = useSettings((s) => s.setCountry);
  const changeLang = useChangeLang();
  const save = useSaveSettings();
  const billing = useBilling().data;
  const contact = useSiteStatus().data?.payments.contact ?? null;
  const summary = usePortfolioSummary(true);
  const news = useQuery({ queryKey: ["news", "all", lang], queryFn: () => getNews({ data: { lang } }), staleTime: 5 * 60_000 });
  const [devices, setDevices] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;
  const name = user.displayName?.trim() || user.primaryEmail?.split("@")[0] || t("account.menu");
  const money = (usd: number) => (currency === "BTC" && summary.btcPrice ? formatBtc(usd / summary.btcPrice) : formatUsd(usd));
  const headline = news.data?.[0];
  const planName = billing ? (billing.trial ? t("plan.trial") : PLAN_LABEL[billing.plan]) : null;

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex items-center gap-3">
        <span className="bg-brand grid size-14 shrink-0 place-items-center rounded-full font-display text-2xl font-bold text-white shadow-[var(--shadow-glow)]">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold text-fg">{t("drawer.hello", { name })}</p>
          {user.primaryEmail ? <p className="truncate text-sm text-muted">{user.primaryEmail}</p> : null}
          {planName ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Crown className="size-3" />
              {planName}
            </span>
          ) : null}
        </div>
        <button type="button" onClick={hide} aria-label={t("common.close")} className="grid size-9 shrink-0 place-items-center self-start rounded-lg text-faint hover:bg-surface-2 hover:text-fg">
          <X className="size-5" />
        </button>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
            <Wallet className="size-4 text-primary" />
            {t("drawer.assets")}
          </p>
          <Segmented<Currency> label={t("drawer.currency")} value={currency} onChange={setCurrency} options={[{ id: "USD", label: "USD" }, { id: "BTC", label: "BTC" }]} />
        </div>
        {summary.loading ? (
          <div className="skeleton mt-3 h-14 w-full" />
        ) : summary.count ? (
          <>
            <p className="mt-3 font-display text-3xl font-extrabold text-fg tabular-nums">{money(summary.total)}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums">
              <span className={summary.day >= 0 ? "text-long" : "text-short"}>
                {t("drawer.day")}: {summary.day >= 0 ? "+" : "−"}
                {money(Math.abs(summary.day))} ({formatPct(summary.dayPct)})
              </span>
              <span className={summary.pnl >= 0 ? "text-long" : "text-short"}>
                {t("drawer.pnl")}: {summary.pnl >= 0 ? "+" : "−"}
                {money(Math.abs(summary.pnl))} ({formatPct(summary.pnlPct)})
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {summary.top.map((r) => (
                <span key={r.base} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg">
                  {r.base} <span className="text-muted tabular-nums">{summary.total > 0 ? `${((r.value / summary.total) * 100).toFixed(0)}%` : ""}</span>
                </span>
              ))}
              {summary.count > 3 ? <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">+{summary.count - 3}</span> : null}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">{t("drawer.noAssets")}</p>
        )}
        <Link to="/portfolio" onClick={hide} className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-fg hover:opacity-90">
          {t(summary.count ? "drawer.openPortfolio" : "drawer.addFirst")}
          <ChevronRight className="size-4" />
        </Link>
      </Card>

      <Card>
        <Link to="/news" onClick={hide} className="block px-4 pt-3.5 pb-3 hover:bg-surface-2/60">
          <p className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Newspaper className="size-4 text-primary" />
            <span className="flex-1">{t("drawer.pulse")}</span>
            {headline ? <span className="size-2 rounded-full bg-short" aria-hidden /> : null}
          </p>
          {news.isLoading ? (
            <div className="skeleton mt-2 h-4 w-full" />
          ) : headline ? (
            <>
              <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-fg">{headline.title}</p>
              <p className="mt-1 text-[11px] text-faint">
                {headline.source}
                {headline.publishedAt ? ` · ${timeAgo(lang, headline.publishedAt)}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-muted">{t("drawer.noNews")}</p>
          )}
        </Link>
        <Link to="/news" onClick={hide} className="block border-t border-border py-2.5 text-center text-sm font-semibold text-primary hover:bg-surface-2/60">
          {t("drawer.allNews")}
        </Link>
      </Card>

      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.label} to={a.to} search={a.search} hash={a.hash} onClick={hide} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center outline-none">
              <span className={cn("grid size-14 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[var(--shadow-glow)]", a.tone)}>
                <Icon className="size-6" />
              </span>
              <span className="text-[11px] leading-tight font-medium text-fg">{t(a.label)}</span>
            </Link>
          );
        })}
      </div>

      <Card className="divide-y divide-border">
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-sm font-medium text-fg">{t("theme.title")}</span>
          <Segmented<Theme>
            label={t("theme.title")}
            value={theme}
            onChange={setTheme}
            options={[
              { id: "light", label: <><Sun className="size-3.5" />{t("drawer.theme.light")}</> },
              { id: "dark", label: <><Moon className="size-3.5" />{t("drawer.theme.dark")}</> },
              { id: "system", label: <><Monitor className="size-3.5" />{t("drawer.theme.system")}</> },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-sm font-medium text-fg">{t("account.language")}</span>
          <Segmented
            label={t("account.language")}
            value={lang}
            onChange={changeLang}
            options={LANGS.map((l) => ({ id: l.id, label: <><span aria-hidden>{l.flag}</span>{l.id === "ru" ? "Русский" : "English"}</> }))}
          />
        </div>
        <label className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-medium text-fg">{t("account.country")}</span>
          <select
            value={country}
            onChange={(e) => {
              const id = e.target.value as CountryId;
              setCountry(id);
              save.mutate({ lang, country: id });
            }}
            className="h-9 max-w-44 rounded-lg bg-surface-2 px-2 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {COUNTRIES.map((c) => (
              <option key={c.id} value={c.id} className="bg-bg">
                {c.flag} {lang === "en" ? c.en : c.ru}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <PlanSummary onNavigate={hide} />

      <Card className="divide-y divide-border overflow-hidden">
        <Row icon={<ShieldCheck className="size-4 text-accent" />} label={t("account.sessions")} onClick={() => setDevices((v) => !v)}>
          <ChevronRight className={cn("size-4 text-faint transition-transform", devices && "rotate-90")} />
        </Row>
        {devices ? (
          <div className="px-4 py-3">
            <Sessions />
          </div>
        ) : null}
        {contact ? <Row icon={<LifeBuoy className="size-4 text-wait" />} label={t("drawer.support")} href={contactHref(contact)} /> : null}
        <Row
          icon={<LogOut className="size-4" />}
          label={signingOut ? t("account.signingOut") : t("account.signOut")}
          danger
          onClick={() => {
            setSigningOut(true);
            void signOut().catch(() => setSigningOut(false));
          }}
        />
      </Card>
    </div>
  );
}

/**
 * Full profile menu: greeting, assets in USD or BTC, fresh news, shortcuts and
 * settings. Slides in from the right; full screen on phones. Portaled to <body>
 * so the blurred header can't clip it.
 */
export function ProfileDrawer() {
  const t = useT();
  const open = useProfileDrawer((s) => s.open);
  const hide = useProfileDrawer((s) => s.hide);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && hide();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, hide]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t("account.menu")}>
      <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={hide} />
      <div className="fade-up absolute inset-y-0 right-0 w-full overflow-y-auto bg-bg shadow-[var(--shadow-pop)] sm:w-[420px]">
        <DrawerBody />
      </div>
    </div>,
    document.body,
  );
}
