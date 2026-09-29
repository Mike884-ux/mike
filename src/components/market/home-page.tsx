import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Eye, LayoutGrid, Rocket, Sparkles, Star, TrendingDown } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { CATEGORIES, MAX_PAGES, PAGE_SIZE, type CategoryId, type ListingResponse, type MarketCoin } from "@/lib/coins";
import { usdCompact, usdPrice } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { scanMarket } from "@/lib/scan";
import { useSettings } from "@/lib/settings-store";
import { useFavorites } from "@/lib/use-account";
import { useGlobalStats, useListing, useTrending, useWatchlist } from "@/lib/use-market";
import { cn } from "@/lib/utils";
import { Change, ChangePill } from "@/components/market/bits";
import { FearGreedCard, MarketCapCard, MoversCard, TrendingCard, useMovers } from "@/components/market/highlights";
import { MarketTable, TableSkeleton, type SignalInfo } from "@/components/market/market-table";
import { Container } from "@/components/site/shell";

export type HomeTab = "all" | "watchlist" | "gainers" | "losers" | CategoryId;

const MAIN_TABS: { id: HomeTab; label: MessageKey; icon: typeof Star }[] = [
  { id: "all", label: "tab.all", icon: LayoutGrid },
  { id: "watchlist", label: "tab.watchlist", icon: Star },
  { id: "gainers", label: "tab.gainers", icon: Rocket },
  { id: "losers", label: "tab.losers", icon: TrendingDown },
];

export function asHomeTab(value: unknown): HomeTab {
  if (MAIN_TABS.some((tab) => tab.id === value) || CATEGORIES.some((c) => c.id === value)) return value as HomeTab;
  return "all";
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm font-medium text-muted outline-none hover:text-fg focus-visible:text-fg"
    >
      {label}
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-primary" : "bg-surface-3")}>
        <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0")} />
      </span>
    </button>
  );
}

function Pagination({ page, lastPage, onPage }: { page: number; lastPage: number; onPage: (page: number) => void }) {
  const t = useT();
  const pages = useMemo(() => {
    const set = new Set<number>([1, lastPage, page - 1, page, page + 1]);
    return [...set].filter((p) => p >= 1 && p <= lastPage).sort((a, b) => a - b);
  }, [page, lastPage]);
  if (lastPage <= 1) return null;
  const item = "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  return (
    <nav className="flex items-center justify-center gap-1" aria-label={t("pager.label")}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("pager.prev")} className={cn(item, "text-muted hover:bg-surface-2 disabled:opacity-40")}>
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - pages[i - 1]! > 1 ? <span className="px-1 text-faint">…</span> : null}
          <button
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "bg-primary text-primary-fg" : "text-fg hover:bg-surface-2")}
          >
            {p}
          </button>
        </span>
      ))}
      <button type="button" disabled={page >= lastPage} onClick={() => onPage(page + 1)} aria-label={t("pager.next")} className={cn(item, "text-muted hover:bg-surface-2 disabled:opacity-40")}>
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-6 py-16 text-center text-sm text-muted">{children}</div>;
}

const FAQ: { q: MessageKey; a: MessageKey }[] = [
  { q: "faq.q1", a: "faq.a1" },
  { q: "faq.q2", a: "faq.a2" },
  { q: "faq.q3", a: "faq.a3" },
  { q: "faq.q4", a: "faq.a4" },
];

function Faq() {
  const t = useT();
  return (
    <section className="mt-14">
      <h2 className="font-display text-xl font-bold text-fg">{t("faq.title")}</h2>
      <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        {FAQ.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-fg hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
              {t(item.q)}
              <ChevronDown className="size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{t(item.a)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function SourceNote({ listing }: { listing: ListingResponse | undefined }) {
  const t = useT();
  if (!listing) return null;
  return (
    <p className="mt-3 text-xs text-faint">
      {t("market.source", {
        source: listing.source === "coingecko" ? "CoinGecko" : listing.source === "coinpaprika" ? "CoinPaprika" : "Binance",
        time: new Date(listing.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      })}
    </p>
  );
}

function MarketOrb() {
  return (
    <div className="market-orb" aria-hidden>
      <div className="market-orb__halo" />
      <div className="market-orb__sphere">
        <span className="market-orb__ring market-orb__ring--one" />
        <span className="market-orb__ring market-orb__ring--two" />
        <span className="market-orb__line" />
        <span className="market-orb__dot market-orb__dot--one" />
        <span className="market-orb__dot market-orb__dot--two" />
        <span className="market-orb__dot market-orb__dot--three" />
      </div>
    </div>
  );
}

function LaunchPanel({ coins, favorites, onToggle }: { coins: MarketCoin[]; favorites: string[]; onToggle: (symbol: string) => void }) {
  const t = useT();
  const [selected, setSelected] = useState(0);
  const coin = coins[Math.min(selected, Math.max(0, coins.length - 1))] ?? null;
  const saved = coin ? favorites.includes(coin.symbol) : false;
  const change = coin?.change24h ?? 0;
  return (
    <section className="launch-panel overflow-hidden rounded-[28px] p-5 sm:p-7">
      <div className="grid items-center gap-8 lg:grid-cols-[1.08fr_.92fr]">
        <div className="relative z-10">
          <p className="text-xs font-extrabold tracking-[.18em] text-accent">{t("launch.eyebrow")}</p>
          <h1 className="mt-3 max-w-xl font-display text-4xl font-extrabold leading-[1.02] text-white sm:text-6xl">{t("launch.title")}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">{t("launch.subtitle")}</p>
          <a href="#market-snapshot" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-50">
            <Eye className="size-4" /> {t("launch.demo")} <ArrowRight className="size-4" />
          </a>
        </div>
        <MarketOrb />
      </div>
      <div id="market-snapshot" className="launch-panel__snapshot relative z-10 mt-8 grid gap-5 rounded-2xl p-5 lg:grid-cols-[.85fr_1.15fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-accent">{t("launch.sample")}</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-white">{t("launch.brief")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{t("launch.briefText")}</p>
          {coin ? <>
            <label className="mt-5 block text-xs font-semibold text-slate-400" htmlFor="snapshot-coin">{t("launch.coin")}</label>
            <select id="snapshot-coin" value={selected} onChange={(event) => setSelected(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm font-semibold text-white outline-none focus:border-accent">
              {coins.slice(0, 8).map((item, index) => <option key={item.id} value={index}>{item.name} · {item.symbol}</option>)}
            </select>
          </> : <div className="skeleton mt-5 h-11 w-full bg-white/10" />}
        </div>
        {coin ? <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-xs text-slate-500">{coin.symbol}</p><p className="mt-1 text-xl font-bold text-white">{usdPrice(coin.price)}</p></div>
            <div><p className="text-xs text-slate-500">{t("launch.change")}</p><Change value={coin.change24h} className="mt-1 text-xl font-bold" /></div>
            <div><p className="text-xs text-slate-500">{t("launch.volume")}</p><p className="mt-1 text-xl font-bold text-white">{usdCompact(coin.volume24h)}</p></div>
          </div>
          <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-relaxed text-slate-300">{t("launch.context", { change: Math.abs(change).toFixed(2) })}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onToggle(coin.symbol)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-slate-950"><Star className={cn("size-4", saved && "fill-current")} />{t(saved ? "launch.saved" : "launch.save")}</button>
            <Link to="/pricing" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-white hover:bg-white/5"><Sparkles className="size-4 text-primary" />{t("launch.proCta")}</Link>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{t("launch.disclaimer")}</p>
        </div> : <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5"><div className="skeleton h-5 w-1/3 bg-white/10" /><div className="skeleton mt-5 h-20 w-full bg-white/10" /><div className="skeleton mt-5 h-10 w-2/3 bg-white/10" /></div>}
      </div>
    </section>
  );
}

export function HomePage({ page, tab }: { page: number; tab: HomeTab }) {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const highlights = useSettings((s) => s.highlights);
  const setHighlights = useSettings((s) => s.setHighlights);
  const { favorites, toggle, signedIn } = useFavorites();

  const category = CATEGORIES.find((c) => c.id === tab)?.id;
  const stats = useGlobalStats();
  const firstPage = useListing(1);
  const current = useListing(tab === "all" ? page : 1, category);
  const watchlist = useWatchlist(tab === "watchlist" ? favorites : []);
  const trending = useTrending();
  const movers = useMovers(firstPage.data?.coins);

  // Indicator signals for members: the same scan the signals page runs.
  const scan = useQuery({
    queryKey: ["scan", "1h"],
    queryFn: () => scanMarket({ data: { interval: "1h" } }),
    enabled: Boolean(user),
    staleTime: 25_000,
    refetchInterval: 60_000,
  });
  const signals = useMemo(() => {
    const map = new Map<string, SignalInfo>();
    for (const row of scan.data ?? []) map.set(row.base, { signal: row.signal, score: row.score });
    return map;
  }, [scan.data]);

  const go = (next: { page?: number; tab?: HomeTab }) => {
    void navigate({ to: "/", search: { page: next.page && next.page > 1 ? next.page : undefined, tab: next.tab && next.tab !== "all" ? next.tab : undefined } });
    if (next.page !== undefined) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onToggleFavorite = (symbol: string) => {
    if (!signedIn) {
      void navigate({ to: "/login", search: { mode: "signup", redirect: "/" } });
      return;
    }
    toggle(symbol);
  };

  let body: ReactNode;
  let coins: MarketCoin[] | undefined;
  let initialSort: { key: "change24h"; dir: "asc" | "desc" } | undefined;
  if (tab === "watchlist") {
    if (!signedIn) {
      body = (
        <EmptyState>
          <Star className="mx-auto mb-3 size-8 text-wait" />
          <p className="font-semibold text-fg">{t("watch.guestTitle")}</p>
          <p className="mt-1">{t("watch.guestText")}</p>
          <Link to="/login" search={{ mode: "signup", redirect: "/?tab=watchlist" }} className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg">
            {t("auth.signup")}
          </Link>
        </EmptyState>
      );
    } else if (!favorites.length) {
      body = <EmptyState>{t("watch.empty")}</EmptyState>;
    } else coins = watchlist.data?.coins;
  } else if (tab === "gainers" || tab === "losers") {
    coins = firstPage.data ? (tab === "gainers" ? movers.gainers : movers.losers).slice(0, 30) : undefined;
    initialSort = { key: "change24h", dir: tab === "gainers" ? "desc" : "asc" };
  } else {
    coins = current.data?.coins;
  }

  const activeQuery = tab === "watchlist" ? watchlist : tab === "gainers" || tab === "losers" ? firstPage : current;
  if (!body) {
    if (coins?.length) {
      body = (
        <MarketTable
          key={tab}
          coins={coins}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          signals={signals}
          initialSort={initialSort}
        />
      );
    } else if (activeQuery.isLoading || (tab === "watchlist" && watchlist.isFetching)) {
      body = <TableSkeleton />;
    } else if (activeQuery.isError) {
      body = (
        <EmptyState>
          <p>{t("home.down")}</p>
          <button type="button" onClick={() => void activeQuery.refetch()} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg">
            {t("common.retry")}
          </button>
        </EmptyState>
      );
    } else {
      body = <EmptyState>{t("home.empty")}</EmptyState>;
    }
  }

  const lastPage = tab === "all" && current.data && current.data.coins.length < PAGE_SIZE ? page : MAX_PAGES;
  const s = stats.data;

  return (
    <Container className="py-6 sm:py-8">
      <LaunchPanel coins={firstPage.data?.coins ?? []} favorites={favorites} onToggle={onToggleFavorite} />
      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-fg sm:text-[28px]">{t("home.title")}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
            {s?.marketCap ? (
              <>
                <span>{t("home.summary", { cap: usdCompact(s.marketCap) })}</span>
                <ChangePill value={s.marketCapChange24h} className="px-1.5 py-0.5 text-xs" />
                <span>{t("home.per24h")}</span>
              </>
            ) : (
              t("home.subtitle")
            )}
          </p>
        </div>
        <Switch checked={highlights} onChange={setHighlights} label={t("home.highlights")} />
      </div>

      {highlights ? (
        <div className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 xl:grid-cols-4 [&>*]:w-[85%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto">
          <TrendingCard coins={trending.data} marketCoins={firstPage.data?.coins} loading={trending.isLoading} />
          <MoversCard firstPage={firstPage.data?.coins} loading={firstPage.isLoading} />
          <MarketCapCard stats={s} firstPage={firstPage.data?.source === "coingecko" ? firstPage.data.coins : undefined} loading={stats.isLoading} />
          <FearGreedCard stats={s} loading={stats.isLoading} />
        </div>
      ) : null}

      <div className="no-scrollbar -mx-4 mt-7 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {MAIN_TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go({ tab: item.id })}
              aria-pressed={active}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className={cn("size-4", item.id === "watchlist" && active && "fill-current")} />
              {t(item.label)}
            </button>
          );
        })}
        <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
        {CATEGORIES.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go({ tab: item.id })}
              aria-pressed={active}
              className={cn(
                "h-9 shrink-0 rounded-xl px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {t(item.key)}
            </button>
          );
        })}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">{body}</div>

      {tab === "all" && coins?.length ? (
        <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted">
            {t("pager.showing", { from: (page - 1) * PAGE_SIZE + 1, to: (page - 1) * PAGE_SIZE + coins.length })}
          </p>
          <Pagination page={page} lastPage={lastPage} onPage={(p) => go({ page: p, tab })} />
        </div>
      ) : null}
      <SourceNote listing={tab === "all" || category ? current.data : firstPage.data} />

      <Faq />
    </Container>
  );
}
