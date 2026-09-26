import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, Gauge, Landmark, Rocket, TrendingDown } from "lucide-react";
import { capSeries } from "@/lib/coins-map";
import type { GlobalStats, MarketCoin, TrendingCoin } from "@/lib/coins";
import { usdCompact, usdPrice } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Change, ChangePill, CoinLogo, Sparkline } from "@/components/market/bits";

function HighlightCard({ icon, title, action, children, className }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-h-[172px] flex-col rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-fg">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function CoinLine({ id, rank, name, symbol, image, right }: { id: string; rank?: number | null; name: string; symbol: string; image: string | null; right: ReactNode }) {
  return (
    <Link
      to="/coins/$id"
      params={{ id }}
      className="-mx-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1.5 outline-none hover:bg-surface-2 focus-visible:bg-surface-2"
    >
      {rank ? <span className="w-6 text-xs text-faint tabular-nums">{rank}</span> : null}
      <CoinLogo src={image} symbol={symbol} className="size-5" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
        {name} <span className="font-medium text-faint">{symbol}</span>
      </span>
      {right}
    </Link>
  );
}

function LinesSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="skeleton h-5 w-full" />
      ))}
    </div>
  );
}

export function MarketCapCard({ stats, firstPage }: { stats: GlobalStats | undefined; firstPage: MarketCoin[] | undefined }) {
  const t = useT();
  const series = useMemo(() => (firstPage ? capSeries(firstPage) : []), [firstPage]);
  return (
    <HighlightCard icon={<Landmark className="size-4 text-primary" />} title={t("hl.cap")}>
      {stats?.marketCap ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-2xl font-bold text-fg tabular-nums">{usdCompact(stats.marketCap)}</span>
            <ChangePill value={stats.marketCapChange24h} className="text-xs" />
          </div>
          {series.length ? (
            <>
              <Sparkline values={series} fill className="mt-auto h-16 w-full" />
              <p className="mt-1 text-[11px] text-faint">{t("hl.capCaption")}</p>
            </>
          ) : (
            <p className="mt-auto text-xs text-muted">
              {t("stats.volume")}: <span className="font-semibold text-fg">{usdCompact(stats.volume24h)}</span>
            </p>
          )}
        </>
      ) : (
        <LinesSkeleton />
      )}
    </HighlightCard>
  );
}

const FNG_ZONES = ["var(--color-short)", "#f28c38", "var(--color-wait)", "#8bcf52", "var(--color-long)"];

/** Colour of the zone a Fear & Greed value falls in (0–24 extreme fear … 76–100 extreme greed). */
export function fngColor(value: number): string {
  return FNG_ZONES[Math.min(4, Math.max(0, Math.floor(value / 20)))]!;
}

/** Half-dial from extreme fear (left) to extreme greed (right), coloured smoothly along the way. */
function FearGreedDial({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 52;
  const cx = 64;
  const cy = 64;
  const point = (pct: number) => {
    const angle = Math.PI - (pct / 100) * Math.PI;
    return [cx + r * Math.cos(angle), cy - r * Math.sin(angle)] as const;
  };
  const [sx, sy] = point(0);
  const [ex, ey] = point(100);
  const [vx, vy] = point(v);
  const color = fngColor(v);
  return (
    <svg viewBox="0 0 128 78" className="h-[78px] w-36" aria-hidden>
      <defs>
        <linearGradient id="fng-scale" x1="0" x2="1" y1="0" y2="0">
          {FNG_ZONES.map((c, i) => (
            <stop key={i} offset={`${i * 25}%`} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <path d={`M${sx} ${sy} A${r} ${r} 0 0 1 ${ex} ${ey}`} stroke="var(--color-surface-2)" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d={`M${sx} ${sy} A${r} ${r} 0 0 1 ${ex} ${ey}`} stroke="url(#fng-scale)" strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.9" />
      <circle cx={vx} cy={vy} r="9" fill={color} opacity="0.25" />
      <circle cx={vx} cy={vy} r="6" fill="#fff" stroke={color} strokeWidth="3" />
      <text x={cx} y={cy - 6} textAnchor="middle" fill={color} className="font-display text-[26px] font-bold">
        {Math.round(v)}
      </text>
    </svg>
  );
}

export function FearGreedCard({ stats }: { stats: GlobalStats | undefined }) {
  const t = useT();
  const fng = stats?.fearGreed;
  return (
    <HighlightCard icon={<Gauge className="size-4 text-wait" />} title={t("fng.title")}>
      {fng ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          <FearGreedDial value={fng.value} />
          <p
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ color: fngColor(fng.value), backgroundColor: `color-mix(in srgb, ${fngColor(fng.value)} 14%, transparent)` }}
          >
            {t(`fng.${fng.label}` as MessageKey)}
          </p>
          <p className="text-center text-[11px] text-faint">{t("hl.fngCaption")}</p>
        </div>
      ) : stats ? (
        <p className="text-sm text-muted">{t("stats.unavailable")}</p>
      ) : (
        <LinesSkeleton />
      )}
    </HighlightCard>
  );
}

export function TrendingCard({ coins, loading }: { coins: TrendingCoin[] | undefined; loading: boolean }) {
  const t = useT();
  return (
    <HighlightCard icon={<Flame className="size-4 text-short" />} title={t("hl.trending")}>
      {coins?.length ? (
        <div className="flex flex-col">
          {coins.slice(0, 4).map((coin) => (
            <CoinLine
              key={coin.id}
              id={coin.id}
              rank={coin.rank}
              name={coin.name}
              symbol={coin.symbol}
              image={coin.image}
              right={<Change value={coin.change24h} className="text-xs" />}
            />
          ))}
        </div>
      ) : loading ? (
        <LinesSkeleton />
      ) : (
        <p className="text-sm text-muted">{t("stats.unavailable")}</p>
      )}
    </HighlightCard>
  );
}

/** Biggest 24h moves among the top 100 with real trading volume. */
export function useMovers(firstPage: MarketCoin[] | undefined) {
  return useMemo(() => {
    const liquid = (firstPage ?? []).filter((c) => c.change24h !== null && (c.volume24h ?? 0) >= 1_000_000);
    const sorted = [...liquid].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
    return { gainers: sorted.filter((c) => (c.change24h ?? 0) > 0), losers: sorted.filter((c) => (c.change24h ?? 0) < 0).reverse() };
  }, [firstPage]);
}

export function MoversCard({ firstPage }: { firstPage: MarketCoin[] | undefined }) {
  const t = useT();
  const [side, setSide] = useState<"up" | "down">("up");
  const { gainers, losers } = useMovers(firstPage);
  const list = (side === "up" ? gainers : losers).slice(0, 4);
  return (
    <HighlightCard
      icon={side === "up" ? <Rocket className="size-4 text-long" /> : <TrendingDown className="size-4 text-short" />}
      title={t(side === "up" ? "hl.gainers" : "hl.losers")}
      action={
        <div className="flex rounded-lg bg-surface-2 p-0.5 text-[11px] font-semibold">
          {(["up", "down"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={side === s}
              onClick={() => setSide(s)}
              className={cn("rounded-md px-2 py-1", side === s ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted hover:text-fg")}
            >
              {t(s === "up" ? "hl.up" : "hl.down")}
            </button>
          ))}
        </div>
      }
    >
      {firstPage ? (
        list.length ? (
          <div className="flex flex-col">
            {list.map((coin) => (
              <CoinLine
                key={coin.id}
                id={coin.id}
                rank={coin.rank}
                name={coin.name}
                symbol={coin.symbol}
                image={coin.image}
                right={
                  <span className="flex flex-col items-end">
                    <span className="text-xs font-semibold text-fg tabular-nums">{usdPrice(coin.price)}</span>
                    <Change value={coin.change24h} className="text-[11px]" />
                  </span>
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("hl.noMovers")}</p>
        )
      ) : (
        <LinesSkeleton />
      )}
    </HighlightCard>
  );
}
