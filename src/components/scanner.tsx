import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, BarChart3, Loader2, Minus, RefreshCw, Search, Star, TrendingDown, TrendingUp } from "lucide-react";
import { getSentiment, scanMarket, type CoinRow } from "@/lib/scan";
import { INTERVALS, type IntervalId } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";
import { assetOf } from "@/lib/markets";
import { useFavorites } from "@/lib/use-account";
import { AssetIcon } from "@/components/asset-icon";
import { Spark } from "@/components/spark";
import { Card, ScoreBar, SignalBadge } from "@/components/ui-bits";
import { CoinDetail } from "@/components/coin-detail";

function fngTone(value: number) {
  if (value <= 25) return "text-short";
  if (value <= 45) return "text-wait";
  if (value <= 55) return "text-muted";
  return "text-long";
}

function FearGreedGauge({ value }: { value: number }) {
  const angleDeg = 180 - (Math.max(0, Math.min(100, value)) / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;
  const tipX = 60 + 38 * Math.cos(angleRad);
  const tipY = 60 - 38 * Math.sin(angleRad);
  return (
    <svg viewBox="0 0 120 68" className="h-14 w-24 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="fngArc" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--color-short)" />
          <stop offset="50%" stopColor="var(--color-wait)" />
          <stop offset="100%" stopColor="var(--color-long)" />
        </linearGradient>
      </defs>
      <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="url(#fngArc)" strokeWidth="8" strokeLinecap="round" />
      <line x1="60" y1="60" x2={tipX} y2={tipY} stroke="var(--color-fg)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="60" cy="60" r="4" fill="var(--color-fg)" />
    </svg>
  );
}

type SortKey = "price" | "change24h" | "rsi" | "score" | "volumeRatio";

type RowProps = {
  row: CoinRow;
  rank: number;
  favorite: boolean;
  onOpen: (row: CoinRow) => void;
  onToggleFavorite: (base: string) => void;
};

/**
 * Re-render a row only when something visible in it changed. Every rescan
 * delivers fresh row objects; without this all 100 rows (with their charts)
 * re-rendered every 30 seconds, which was a visible hitch on phones.
 */
const CoinRowView = memo(CoinRowViewInner, (a, b) => {
  const x = a.row;
  const y = b.row;
  return (
    a.rank === b.rank &&
    a.favorite === b.favorite &&
    a.onOpen === b.onOpen &&
    a.onToggleFavorite === b.onToggleFavorite &&
    x.price === y.price &&
    x.change24h === y.change24h &&
    x.rsi === y.rsi &&
    x.trend === y.trend &&
    x.signal === y.signal &&
    x.score === y.score &&
    x.volumeRatio === y.volumeRatio &&
    x.spark.at(-1) === y.spark.at(-1) &&
    x.spark[0] === y.spark[0]
  );
});

function CoinRowViewInner({ row, rank, favorite, onOpen, onToggleFavorite }: RowProps) {
  const onOpenDetail = () => onOpen(row);
  const t = useT();
  const TrendIcon = row.trend === "up" ? ArrowUp : row.trend === "down" ? ArrowDown : Minus;
  const prevPriceRef = useRef(row.price);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    const prev = prevPriceRef.current;
    if (row.price !== prev) {
      setFlash(row.price > prev ? "up" : "down");
      prevPriceRef.current = row.price;
      const timer = setTimeout(() => setFlash(null), 900);
      return () => clearTimeout(timer);
    }
  }, [row.price]);
  return (
    <tr
      onClick={onOpenDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault(); // Space would otherwise also scroll the page
          onOpenDetail();
        }
      }}
      className="cursor-pointer border-b border-border/60 outline-none transition-colors last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2"
    >
      <td className="py-2.5 pr-1 pl-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(row.base);
          }}
          onKeyDown={(event) => event.stopPropagation()}
          aria-pressed={favorite}
          aria-label={t("scan.addFavorite")}
          className="flex size-6 items-center justify-center text-faint outline-none hover:text-wait focus-visible:text-wait"
        >
          <Star className={`size-3.5 ${favorite ? "fill-wait text-wait" : ""}`} />
        </button>
      </td>
      <td className="hidden px-2 py-2.5 font-mono text-[11px] text-faint sm:table-cell">{rank}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <AssetIcon base={row.base} kind={row.kind} />
          <span className="font-mono text-sm font-semibold text-fg">{row.base}</span>
        </div>
      </td>
      <td
        className={`px-3 py-2.5 text-right font-mono text-sm tabular-nums text-fg transition-colors duration-700 ${
          flash === "up" ? "bg-long/20" : flash === "down" ? "bg-short/20" : ""
        }`}
      >
        {formatPrice(row.price)}
      </td>
      <td className={`px-3 py-2.5 text-right font-mono text-xs tabular-nums ${row.change24h >= 0 ? "text-long" : "text-short"}`}>
        {row.change24h >= 0 ? "+" : ""}
        {row.change24h.toFixed(2)}%
      </td>
      <td className="hidden px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted sm:table-cell">{row.rsi}</td>
      <td className="hidden px-3 py-2.5 sm:table-cell">
        <span className={`flex items-center gap-1 text-xs ${row.trend === "up" ? "text-long" : row.trend === "down" ? "text-short" : "text-faint"}`}>
          <TrendIcon className="size-3" />
          {t(`trend.${row.trend}` as MessageKey)}
        </span>
      </td>
      <td className="hidden px-3 py-2.5 md:table-cell">
        <Spark values={row.spark} className="h-8 w-20" />
      </td>
      <td className="hidden px-3 py-2.5 text-right lg:table-cell">
        <span className={`font-mono text-xs tabular-nums ${row.volumeRatio >= 1.8 ? "font-semibold text-accent" : "text-muted"}`}>
          {row.volumeRatio.toFixed(1)}×
        </span>
      </td>
      <td className="px-3 py-2.5">
        <SignalBadge signal={row.signal} />
      </td>
      <td className="hidden px-3 py-2.5 lg:table-cell">
        <ScoreBar score={row.score} />
      </td>
    </tr>
  );
}

function SortTh({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className={`px-3 py-2.5 text-right font-normal ${className ?? ""}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`ml-auto flex items-center gap-1 outline-none hover:text-fg focus-visible:text-fg ${active ? "text-fg" : "text-faint"}`}
      >
        {label}
        {active ? sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </button>
    </th>
  );
}

const CATEGORIES = [
  { id: "all", label: "scan.cat.all" },
  { id: "crypto", label: "scan.cat.crypto" },
  { id: "stock", label: "scan.cat.stock" },
] as const;
type CategoryId = (typeof CATEGORIES)[number]["id"];

function MoverList({ rows, onPick }: { rows: CoinRow[]; onPick: (row: CoinRow) => void }) {
  return (
    <div className="mt-1.5 flex flex-col">
      {rows.map((row) => (
        <button
          key={row.symbol}
          type="button"
          onClick={() => onPick(row)}
          className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left outline-none hover:bg-surface-2 focus-visible:bg-surface-2"
        >
          <span className="flex items-center gap-1.5 text-xs">
            <AssetIcon base={row.base} kind={row.kind} className="size-5" />
            <span className="font-mono font-semibold text-fg">{row.base}</span>
          </span>
          <span className={`font-mono text-xs tabular-nums ${row.change24h >= 0 ? "text-long" : "text-short"}`}>
            {row.change24h >= 0 ? "+" : ""}
            {row.change24h.toFixed(2)}%
          </span>
        </button>
      ))}
    </div>
  );
}

function ScanTab({ favorites, onToggleFavorite }: { favorites: string[]; onToggleFavorite: (base: string) => void }) {
  const t = useT();
  const [interval, setScanInterval] = useState<IntervalId>("1h");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId>("all");
  const [selected, setSelected] = useState<CoinRow | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [moverTab, setMoverTab] = useState<"up" | "down">("up");

  const scan = useQuery({
    queryKey: ["scan", interval],
    queryFn: () => scanMarket({ data: { interval } }),
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const sentiment = useQuery({
    queryKey: ["sentiment"],
    queryFn: () => getSentiment(),
    staleTime: 300_000,
    refetchInterval: 300_000,
    refetchOnWindowFocus: false,
  });

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  const rows = useMemo(() => {
    let list = scan.data ?? [];
    if (category !== "all") list = list.filter((row) => row.kind === category);
    if (favoritesOnly) list = list.filter((row) => favorites.includes(row.base));
    const needle = query.trim().toUpperCase();
    if (needle) {
      // Names and aliases work too: "биткоин", "apple", "золото".
      const alias = assetOf(query)?.base;
      list = list.filter((row) => row.base.includes(needle) || row.base === alias);
    }
    if (sort) {
      list = [...list].sort((a, b) => (sort.dir === "asc" ? a[sort.key] - b[sort.key] : b[sort.key] - a[sort.key]));
    }
    return list;
  }, [scan.data, query, category, favoritesOnly, favorites, sort]);

  const byChange = useMemo(() => [...(scan.data ?? [])].sort((a, b) => b.change24h - a.change24h), [scan.data]);
  const movers = moverTab === "up" ? byChange.slice(0, 5) : byChange.slice(-5).reverse();
  const spikes = useMemo(
    () => [...(scan.data ?? [])].filter((r) => r.volumeRatio >= 1.8).sort((a, b) => b.volumeRatio - a.volumeRatio).slice(0, 5),
    [scan.data],
  );

  // Show the freshest row for the open coin, so its price keeps updating with
  // the 20-second rescans instead of freezing at the moment it was clicked.
  const selectedRow = selected ? (scan.data?.find((row) => row.base === selected.base) ?? selected) : null;
  const closeDetail = useCallback(() => setSelected(null), []);
  const openRow = useCallback((row: CoinRow) => setSelected(row), []);

  const longCount = rows.filter((r) => r.signal === "LONG").length;
  const shortCount = rows.filter((r) => r.signal === "SHORT").length;
  const stats = [
    { label: "scan.stats.assets", value: rows.length, tone: "text-fg", accent: "bg-primary" },
    { label: "scan.stats.long", value: longCount, tone: "text-long", accent: "bg-long" },
    { label: "scan.stats.short", value: shortCount, tone: "text-short", accent: "bg-short" },
    { label: "scan.stats.wait", value: rows.length - longCount - shortCount, tone: "text-wait", accent: "bg-wait" },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">{t("scan.title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {scan.isLoading ? <span className="shimmer-text">{t("scan.computing")}</span> : t("scan.subtitle")}
          </p>
          {scan.isError && scan.data ? (
            <p role="status" className="mt-1 text-xs text-wait">
              {t("scan.stale")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void scan.refetch()}
          disabled={scan.isFetching}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-xs text-muted outline-none hover:text-fg disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {scan.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {t("common.refresh")}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="flex items-center gap-3 p-3">
          {sentiment.data ? (
            <>
              <FearGreedGauge value={sentiment.data.value} />
              <div>
                <p className="text-[11px] text-faint">{t("fng.title")}</p>
                <p className={`font-mono text-lg font-semibold tabular-nums ${fngTone(sentiment.data.value)}`}>
                  {sentiment.data.value} · {t(`fng.${sentiment.data.label}` as MessageKey)}
                </p>
              </div>
            </>
          ) : (
            <div className="h-14 w-full animate-pulse rounded-lg bg-surface-2" />
          )}
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1">
            {(["up", "down"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={moverTab === tab}
                onClick={() => setMoverTab(tab)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${moverTab === tab ? "bg-surface-2 text-fg" : "text-faint hover:text-fg"}`}
              >
                {tab === "up" ? <TrendingUp className="size-3 text-long" /> : <TrendingDown className="size-3 text-short" />}
                {t(tab === "up" ? "scan.topGainers" : "scan.topLosers")}
              </button>
            ))}
          </div>
          <MoverList rows={movers} onPick={setSelected} />
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1.5 text-[11px] text-faint">
            <BarChart3 className="size-3 text-accent" />
            {t("scan.volumeSpikes")}
          </p>
          {spikes.length ? (
            <div className="mt-1.5 flex flex-col">
              {spikes.map((row) => (
                <button
                  key={row.symbol}
                  type="button"
                  onClick={() => setSelected(row)}
                  className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-surface-2"
                >
                  <span className="flex items-center gap-1.5 text-xs">
                    <AssetIcon base={row.base} kind={row.kind} className="size-5" />
                    <span className="font-mono font-semibold text-fg">{row.base}</span>
                    <SignalBadge signal={row.signal} className="px-1.5 py-0.5 text-[9px]" />
                  </span>
                  <span className="font-mono text-xs text-accent tabular-nums">{t("scan.volumeTimes", { x: row.volumeRatio.toFixed(1) })}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">{scan.isLoading ? "…" : t("scan.noSpikes")}</p>
          )}
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-2.5 p-3">
            <span className={`h-8 w-1 shrink-0 rounded-full ${s.accent}`} />
            <div>
              <p className="text-[11px] text-faint">{t(s.label)}</p>
              <p className={`font-mono text-lg font-semibold tabular-nums ${s.tone}`}>{scan.isLoading ? "—" : s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-3 flex flex-col gap-2 p-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative order-1 sm:order-2">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("scan.search")}
            aria-label={t("scan.search")}
            className="h-9 w-full rounded-lg bg-surface-2 pr-3 pl-8 text-xs text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-56"
          />
        </div>
        <div className="order-2 flex flex-wrap items-center gap-2 sm:order-1">
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-pressed={favoritesOnly}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              favoritesOnly ? "bg-wait/20 text-wait" : "bg-surface-2 text-muted hover:text-fg"
            }`}
          >
            <Star className={`size-3.5 ${favoritesOnly ? "fill-wait" : ""}`} />
            {t("scan.favorites")}
          </button>
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                aria-pressed={category === item.id}
                className={`h-7 rounded-md px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  category === item.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
                }`}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
            {INTERVALS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScanInterval(item.id)}
                aria-pressed={interval === item.id}
                className={`h-7 rounded-md px-2.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  interval === item.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
                }`}
              >
                {item.id}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {scan.isLoading ? (
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : rows.length ? (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border text-left text-xs text-faint">
                <th className="py-2.5 pr-1 pl-3 font-normal" />
                <th className="hidden px-2 py-2.5 font-normal sm:table-cell">#</th>
                <th className="px-3 py-2.5 font-normal">{t("scan.col.asset")}</th>
                <SortTh label={t("scan.col.price")} sortKey="price" sort={sort} onSort={toggleSort} />
                <SortTh label={t("scan.col.change")} sortKey="change24h" sort={sort} onSort={toggleSort} />
                <SortTh label={t("scan.col.rsi")} sortKey="rsi" sort={sort} onSort={toggleSort} className="hidden sm:table-cell" />
                <th className="hidden px-3 py-2.5 font-normal sm:table-cell">{t("scan.col.trend")}</th>
                <th className="hidden px-3 py-2.5 font-normal md:table-cell">{t("scan.col.chart")}</th>
                <SortTh label={t("scan.col.volume")} sortKey="volumeRatio" sort={sort} onSort={toggleSort} className="hidden lg:table-cell" />
                <th className="px-3 py-2.5 font-normal">{t("scan.col.signal")}</th>
                <SortTh label={t("scan.col.score")} sortKey="score" sort={sort} onSort={toggleSort} className="hidden lg:table-cell" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <CoinRowView
                  key={row.symbol}
                  row={row}
                  rank={i + 1}
                  favorite={favorites.includes(row.base)}
                  onOpen={openRow}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <p className="mt-8 text-sm text-muted">
          {scan.isError ? t("scan.down") : favoritesOnly ? t("scan.emptyFav") : t("scan.empty")}
        </p>
      )}
      <p className="pt-4 pb-6 text-[11px] text-faint">{t("common.disclaimer")}</p>

      {selectedRow ? <CoinDetail row={selectedRow} interval={interval} onClose={closeDetail} /> : null}
    </div>
  );
}

/** The signals scanner page (members only): indicator signals across the tape. */
export function SignalsPage() {
  const { favorites, toggle } = useFavorites();
  return <ScanTab favorites={favorites} onToggleFavorite={toggle} />;
}
