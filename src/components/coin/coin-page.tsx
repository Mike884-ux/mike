import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, Check, ChevronRight, FileText, Github, Globe, Info, Link2, MessageCircle, Plus, Search, Share2, Star, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAccount } from "@/lib/account";
import { getPrices } from "@/lib/wallet";
import { MarketError, type CoinInfo } from "@/lib/coins";
import { numFull, share, usdFull, usdPrice } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { parseAmount } from "@/lib/portfolio-math";
import { useSettings } from "@/lib/settings-store";
import { ACCOUNT_KEY, useFavorites } from "@/lib/use-account";
import { useCoinInfo } from "@/lib/use-market";
import { cn } from "@/lib/utils";
import { ChangePill, CoinLogo, Meter } from "@/components/market/bits";
import { Container } from "@/components/site/shell";
import { AboutSection, ChartSection, NewsSection, PerformanceRow, RecordsSection, SignalsSection } from "@/components/coin/coin-sections";
import { TradeDialog } from "@/components/coin/trade-dialog";

function Crumbs({ name }: { name: string }) {
  const t = useT();
  return (
    <nav className="flex items-center gap-1 text-sm text-muted" aria-label={t("coin.breadcrumbs")}>
      <Link to="/" className="hover:text-fg">
        {t("nav.coins")}
      </Link>
      <ChevronRight className="size-3.5 text-faint" />
      <span className="truncate font-semibold text-fg">{name}</span>
    </nav>
  );
}

function ShareButton({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const onShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${coin.name} (${coin.symbol})`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* dismissed */
    }
  };
  return (
    <button
      type="button"
      onClick={() => void onShare()}
      aria-label={t("coin.share")}
      title={copied ? t("coin.copied") : t("coin.share")}
      className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg"
    >
      {copied ? <Check className="size-4 text-long" /> : <Share2 className="size-4" />}
    </button>
  );
}

/** The member's position in this coin, from the saved portfolio. */
function useHolding(coin: CoinInfo, signedIn: boolean) {
  const account = useQuery({ queryKey: ACCOUNT_KEY, queryFn: () => getAccount(), staleTime: 30_000, enabled: signedIn });
  const position = account.data?.positions.find((p) => p.base === coin.symbol) ?? null;
  const prices = useQuery({
    queryKey: ["wallet-prices", position?.symbol ?? ""],
    queryFn: () => getPrices({ data: { symbols: [position!.symbol] } }),
    enabled: Boolean(position) && !/\.CG$/.test(position?.symbol ?? ""),
    staleTime: 20_000,
  });
  const price = prices.data?.[0]?.price ?? coin.price;
  return position ? { ...position, price, value: position.qty * price, pnl: (price - position.entry) * position.qty } : null;
}

/** "You hold 0.5 BTC ≈ $32,000 (+4.1%)" with an add-trade button. */
function HoldingCard({ coin, onTrade }: { coin: CoinInfo; onTrade: () => void }) {
  const t = useT();
  const { signedIn } = useFavorites();
  const holding = useHolding(coin, signedIn);
  const pnlPct = holding && holding.entry > 0 ? ((holding.price - holding.entry) / holding.entry) * 100 : 0;
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
        <Wallet className="size-4 text-primary" />
        {t("trade.inPortfolio")}
      </p>
      {holding ? (
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-xl font-bold text-fg tabular-nums">
              {Number(holding.qty.toPrecision(8))} {coin.symbol}
            </p>
            <p className="text-xs text-muted tabular-nums">
              ≈ {usdPrice(holding.value)} ·{" "}
              <span className={holding.pnl >= 0 ? "text-long" : "text-short"}>
                {holding.pnl >= 0 ? "+" : "−"}
                {usdPrice(Math.abs(holding.pnl))} ({pnlPct >= 0 ? "+" : ""}
                {pnlPct.toFixed(1)}%)
              </span>
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">{t(signedIn ? "trade.none" : "trade.guest")}</p>
      )}
      <button
        type="button"
        onClick={onTrade}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-fg hover:opacity-90"
      >
        <Plus className="size-4" />
        {t("trade.add")}
      </button>
    </div>
  );
}

function Identity({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const navigate = useNavigate();
  const { favorites, toggle, signedIn } = useFavorites();
  const starred = favorites.includes(coin.symbol);
  return (
    <div className="flex items-center gap-3">
      <CoinLogo src={coin.image} symbol={coin.symbol} className="size-10" />
      <div className="min-w-0 flex-1">
        <h1 className="flex flex-wrap items-baseline gap-x-2 font-display text-2xl leading-tight font-bold text-fg">
          <span className="truncate">{coin.name}</span>
          <span className="text-base font-semibold text-faint">{coin.symbol}</span>
        </h1>
        {coin.rank ? <span className="mt-1 inline-block rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">#{coin.rank}</span> : null}
      </div>
      <button
        type="button"
        onClick={() => (signedIn ? toggle(coin.symbol) : void navigate({ to: "/login", search: { mode: "signup", redirect: `/coins/${coin.id}` } }))}
        aria-pressed={starred}
        aria-label={t(starred ? "table.unstar" : "table.star", { name: coin.name })}
        className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted hover:bg-surface-3 hover:text-wait"
      >
        <Star className={cn("size-4", starred && "fill-wait text-wait")} />
      </button>
      <ShareButton coin={coin} />
    </div>
  );
}

function RangeBar({ low, high, price }: { low: number | null; high: number | null; price: number }) {
  const t = useT();
  if (low === null || high === null || high <= low) return null;
  const pos = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-short/60 via-wait/60 to-long/60">
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-fg" style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>
          {t("coin.low24")} <span className="font-semibold text-fg tabular-nums">{usdPrice(low)}</span>
        </span>
        <span>
          {t("coin.high24")} <span className="font-semibold text-fg tabular-nums">{usdPrice(high)}</span>
        </span>
      </div>
    </div>
  );
}

function StatRow({ label, hint, children }: { label: MessageKey; hint?: MessageKey; children: ReactNode }) {
  const t = useT();
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-0">
      <span className="flex items-center gap-1 text-sm text-muted">
        {t(label)}
        {hint ? (
          <span title={t(hint)} className="text-faint">
            <Info className="size-3.5" />
          </span>
        ) : null}
      </span>
      <span className="text-right text-sm font-semibold text-fg tabular-nums">{children}</span>
    </div>
  );
}

function Stats({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const volShare = share(coin.volume24h, coin.marketCap);
  const supplyShare = share(coin.circulating, coin.maxSupply);
  return (
    <div className="rounded-2xl bg-surface px-4 shadow-[var(--shadow-border)]">
      <StatRow label="table.marketCap" hint="table.marketCapHint">
        {usdFull(coin.marketCap)}
      </StatRow>
      <StatRow label="table.volume" hint="table.volumeHint">
        {usdFull(coin.volume24h)}
      </StatRow>
      <StatRow label="coin.volCap" hint="coin.volCapHint">
        {volShare !== null ? `${volShare.toFixed(2)}%` : "—"}
      </StatRow>
      <StatRow label="coin.fdv" hint="coin.fdvHint">
        {usdFull(coin.fdv)}
      </StatRow>
      <StatRow label="table.supply" hint="table.supplyHint">
        <span className="block">{coin.circulating ? `${numFull(coin.circulating)} ${coin.symbol}` : "—"}</span>
        {supplyShare !== null ? (
          <span className="mt-1.5 flex items-center justify-end gap-2">
            <Meter percent={supplyShare} className="w-24" />
            <span className="text-xs font-medium text-muted">{supplyShare.toFixed(1)}%</span>
          </span>
        ) : null}
      </StatRow>
      <StatRow label="coin.totalSupply">{coin.totalSupply ? `${numFull(coin.totalSupply)} ${coin.symbol}` : "—"}</StatRow>
      <StatRow label="coin.maxSupply">{coin.maxSupply ? `${numFull(coin.maxSupply)} ${coin.symbol}` : t("coin.noMax")}</StatRow>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function LinkPill({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="flex h-8 max-w-full items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-xs font-semibold text-fg hover:bg-surface-3"
    >
      {icon}
      <span className="truncate">{children}</span>
    </a>
  );
}

function Links({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const l = coin.links;
  const items: ReactNode[] = [];
  if (l.homepage) items.push(<LinkPill key="web" href={l.homepage} icon={<Globe className="size-3.5" />}>{hostOf(l.homepage)}</LinkPill>);
  if (l.whitepaper) items.push(<LinkPill key="wp" href={l.whitepaper} icon={<FileText className="size-3.5" />}>{t("coin.whitepaper")}</LinkPill>);
  l.explorers.forEach((url) => items.push(<LinkPill key={url} href={url} icon={<Search className="size-3.5" />}>{hostOf(url)}</LinkPill>));
  if (l.github) items.push(<LinkPill key="gh" href={l.github} icon={<Github className="size-3.5" />}>GitHub</LinkPill>);
  if (l.twitter) items.push(<LinkPill key="x" href={l.twitter} icon={<Link2 className="size-3.5" />}>X (Twitter)</LinkPill>);
  if (l.reddit) items.push(<LinkPill key="rd" href={l.reddit} icon={<MessageCircle className="size-3.5" />}>Reddit</LinkPill>);
  if (l.telegram) items.push(<LinkPill key="tg" href={l.telegram} icon={<MessageCircle className="size-3.5" />}>Telegram</LinkPill>);
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-fg">{t("coin.links")}</p>
      <div className="flex flex-wrap gap-1.5">{items}</div>
    </div>
  );
}

/** User-typed amount ("0,5", "1 000") or null. */
function toNum(raw: string): number | null {
  const n = parseAmount(raw);
  return Number.isFinite(n) ? n : null;
}

function trimNumber(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Number(value.toFixed(digits)));
}

function Converter({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const [amount, setAmount] = useState("1");
  const [usd, setUsd] = useState(() => trimNumber(coin.price, coin.price >= 1 ? 2 : 8));
  const [lastEdited, setLastEdited] = useState<"coin" | "usd">("coin");

  // Keep the converted side in step with the live price.
  useEffect(() => {
    if (lastEdited === "coin") {
      const n = toNum(amount);
      setUsd(n !== null ? trimNumber(n * coin.price, 2) : "");
    } else {
      const n = toNum(usd);
      setAmount(n !== null && coin.price > 0 ? trimNumber(n / coin.price, 8) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute only when the price moves
  }, [coin.price]);

  const field = "h-11 min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-fg outline-none tabular-nums";
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
        <ArrowLeftRight className="size-4 text-primary" />
        {t("coin.converter", { symbol: coin.symbol })}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <label className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-primary/40">
          <span className="text-xs font-semibold text-muted">{coin.symbol}</span>
          <input
            inputMode="decimal"
            value={amount}
            aria-label={coin.symbol}
            onChange={(event) => {
              setAmount(event.target.value);
              setLastEdited("coin");
              const n = toNum(event.target.value);
              setUsd(n !== null ? trimNumber(n * coin.price, 2) : "");
            }}
            className={field}
          />
        </label>
        <label className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-primary/40">
          <span className="text-xs font-semibold text-muted">USD</span>
          <input
            inputMode="decimal"
            value={usd}
            aria-label="USD"
            onChange={(event) => {
              setUsd(event.target.value);
              setLastEdited("usd");
              const n = toNum(event.target.value);
              setAmount(n !== null && coin.price > 0 ? trimNumber(n / coin.price, 8) : "");
            }}
            className={field}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-faint">
        1 {coin.symbol} = {usdPrice(coin.price)}
      </p>
    </div>
  );
}

function CoinSkeleton() {
  return (
    <Container className="py-6">
      <span className="skeleton block h-4 w-48" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <span className="skeleton h-10 w-2/3" />
          <span className="skeleton h-9 w-1/2" />
          <span className="skeleton h-64 w-full rounded-2xl" />
        </div>
        <span className="skeleton h-[480px] w-full rounded-2xl" />
      </div>
    </Container>
  );
}

function Missing({ notFound, onRetry }: { notFound: boolean; onRetry: () => void }) {
  const t = useT();
  return (
    <Container className="py-20 text-center">
      <p className="font-display text-2xl font-bold text-fg">{t(notFound ? "coin.notFound" : "coin.unavailable")}</p>
      <p className="mt-2 text-sm text-muted">{t(notFound ? "coin.notFoundText" : "coin.unavailableText")}</p>
      <div className="mt-6 flex justify-center gap-2">
        {notFound ? null : (
          <button type="button" onClick={onRetry} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg">
            {t("common.retry")}
          </button>
        )}
        <Link to="/" className="rounded-xl bg-surface-2 px-4 py-2 text-sm font-semibold text-fg">
          {t("coin.backToList")}
        </Link>
      </div>
    </Container>
  );
}

export function CoinPage({ id }: { id: string }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const navigate = useNavigate();
  const { signedIn } = useFavorites();
  const query = useCoinInfo(id, lang);
  const coin = query.data;
  const [trading, setTrading] = useState(false);
  const holding = useHolding(coin ?? { symbol: "", price: 0 } as CoinInfo, signedIn && Boolean(coin));
  const openTrade = () => (signedIn ? setTrading(true) : void navigate({ to: "/login", search: { mode: "signup", redirect: `/coins/${id}` } }));

  useEffect(() => {
    if (coin) document.title = `${coin.name} (${coin.symbol}) ${usdPrice(coin.price)} — ${t("app.name")}`;
  }, [coin, t]);

  if (query.isLoading) return <CoinSkeleton />;
  if (!coin) {
    const notFound = query.error instanceof MarketError && query.error.status === 404;
    return <Missing notFound={notFound} onRetry={() => void query.refetch()} />;
  }

  return (
    <Container className="py-5 sm:py-6">
      <Crumbs name={coin.name} />
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,370px)_minmax(0,1fr)] lg:gap-8">
        <aside className="flex min-w-0 flex-col gap-5">
          <Identity coin={coin} />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-[32px] leading-none font-bold text-fg tabular-nums">{usdPrice(coin.price)}</span>
              <ChangePill value={coin.change24h} suffix={` ${t("coin.day")}`} />
            </div>
            <div className="mt-4">
              <RangeBar low={coin.low24h} high={coin.high24h} price={coin.price} />
            </div>
          </div>
          <HoldingCard coin={coin} onTrade={openTrade} />
          <Stats coin={coin} />
          <Links coin={coin} />
          <Converter coin={coin} />
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <ChartSection coin={coin} />
          <PerformanceRow coin={coin} />
          <SignalsSection coin={coin} />
          <AboutSection coin={coin} />
          <RecordsSection coin={coin} />
          <NewsSection coin={coin} />
          {coin.source !== "coingecko" ? <p className="text-xs text-faint">{t("coin.partial")}</p> : null}
        </div>
      </div>
      {trading ? <TradeDialog coin={coin} held={holding?.qty ?? 0} onClose={() => setTrading(false)} /> : null}
    </Container>
  );
}
