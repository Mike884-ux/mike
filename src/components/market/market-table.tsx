import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Info, Star } from "lucide-react";
import type { MarketCoin } from "@/lib/coins";
import { numCompact, numFull, share, usdFull, usdPrice } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import type { Signal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Change, CoinLogo, Meter, Sparkline } from "@/components/market/bits";
import { SignalBadge } from "@/components/ui-bits";

export type SortKey = "rank" | "price" | "change1h" | "change24h" | "change7d" | "marketCap" | "volume24h";
type Sort = { key: SortKey; dir: "asc" | "desc" };

export type SignalInfo = { signal: Signal; score: number };

type RowProps = {
  coin: MarketCoin;
  favorite: boolean;
  signal: SignalInfo | undefined;
  showSignals: boolean;
  showChart: boolean;
  onToggleFavorite: (symbol: string) => void;
};

/**
 * Only re-render when something visible changed: every minute brings fresh
 * objects for all 100 rows, and repainting their sparklines was the costliest
 * part of a refresh.
 */
const Row = memo(RowInner, (a, b) => {
  const x = a.coin;
  const y = b.coin;
  return (
    a.favorite === b.favorite &&
    a.showSignals === b.showSignals &&
    a.showChart === b.showChart &&
    a.signal?.signal === b.signal?.signal &&
    a.onToggleFavorite === b.onToggleFavorite &&
    x.id === y.id &&
    x.rank === y.rank &&
    x.price === y.price &&
    x.change1h === y.change1h &&
    x.change24h === y.change24h &&
    x.change7d === y.change7d &&
    x.marketCap === y.marketCap &&
    x.volume24h === y.volume24h &&
    x.circulating === y.circulating &&
    x.spark.length === y.spark.length &&
    x.spark.at(-1) === y.spark.at(-1)
  );
});

function RowInner({ coin, favorite, signal, showSignals, showChart, onToggleFavorite }: RowProps) {
  const t = useT();
  const navigate = useNavigate();
  const previous = useRef(coin.price);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (coin.price !== previous.current) {
      setFlash(coin.price > previous.current ? "up" : "down");
      setFlashKey((k) => k + 1);
      previous.current = coin.price;
    }
  }, [coin.price]);

  const open = () => void navigate({ to: "/coins/$id", params: { id: coin.id } });
  const supplyShare = share(coin.circulating, coin.maxSupply);
  const volumeInCoins = coin.volume24h && coin.price > 0 ? coin.volume24h / coin.price : null;

  return (
    <tr
      onClick={(event) => {
        // Clicks on the star or the name link are handled by those elements.
        if ((event.target as HTMLElement).closest("a,button")) return;
        open();
      }}
      className="group cursor-pointer border-b border-border last:border-0 hover:bg-surface-2"
    >
      <td className="sticky left-0 z-[1] bg-surface py-3 pr-0 pl-1.5 group-hover:bg-surface-2 sm:static sm:bg-transparent sm:pl-3 sm:group-hover:bg-transparent">
        <button
          type="button"
          onClick={() => onToggleFavorite(coin.symbol)}
          aria-pressed={favorite}
          aria-label={t(favorite ? "table.unstar" : "table.star", { name: coin.name })}
          className="grid size-7 place-items-center rounded-md text-faint outline-none hover:text-wait focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Star className={cn("size-4", favorite && "fill-wait text-wait")} />
        </button>
      </td>
      <td className="hidden px-2 py-3 text-left text-xs font-medium text-muted tabular-nums sm:table-cell">{coin.rank ?? "—"}</td>
      <td className="sticky left-8 z-[1] bg-surface px-1.5 py-3 group-hover:bg-surface-2 sm:static sm:bg-transparent sm:px-2 sm:group-hover:bg-transparent">
        <Link
          to="/coins/$id"
          params={{ id: coin.id }}
          className="flex min-w-0 items-center gap-2.5 outline-none focus-visible:underline"
        >
          <CoinLogo src={coin.image} symbol={coin.symbol} />
          <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
            <span className="max-w-[6.5rem] truncate text-sm font-semibold text-fg sm:max-w-[12rem]">{coin.name}</span>
            <span className="text-xs font-medium text-faint">{coin.symbol}</span>
          </span>
        </Link>
      </td>
      <td
        key={flashKey}
        className={cn(
          "px-2 py-3 text-right text-[13px] font-semibold text-fg tabular-nums sm:px-3 sm:text-sm",
          flash === "up" && "flash-up",
          flash === "down" && "flash-down",
        )}
      >
        {usdPrice(coin.price)}
      </td>
      <td className="hidden px-3 py-3 text-right text-sm lg:table-cell">
        <Change value={coin.change1h} />
      </td>
      <td className="px-2 py-3 text-right text-[13px] sm:px-3 sm:text-sm">
        <Change value={coin.change24h} />
      </td>
      <td className="hidden px-3 py-3 text-right text-sm md:table-cell">
        <Change value={coin.change7d} />
      </td>
      <td className="hidden px-3 py-3 text-right text-sm font-medium text-fg tabular-nums md:table-cell">{usdFull(coin.marketCap)}</td>
      <td className="hidden px-3 py-3 text-right xl:table-cell">
        <p className="text-sm font-medium text-fg tabular-nums">{usdFull(coin.volume24h)}</p>
        {volumeInCoins ? (
          <p className="text-xs text-faint tabular-nums">
            {numCompact(volumeInCoins)} {coin.symbol}
          </p>
        ) : null}
      </td>
      <td className="hidden px-3 py-3 text-right xl:table-cell">
        <p className="text-sm font-medium whitespace-nowrap text-fg tabular-nums">
          {coin.circulating ? `${coin.circulating >= 1e9 ? numCompact(coin.circulating) : numFull(coin.circulating)} ${coin.symbol}` : "—"}
        </p>
        {supplyShare !== null ? <Meter percent={supplyShare} className="ml-auto mt-1.5 w-32" /> : null}
      </td>
      {showChart ? (
        <td className="hidden py-2 pr-4 pl-3 lg:table-cell">
          <Sparkline values={coin.spark} className="ml-auto h-12 w-40" up={coin.change7d !== null ? coin.change7d >= 0 : undefined} />
        </td>
      ) : null}
      {showSignals ? (
        <td className="hidden px-3 py-3 text-right lg:table-cell">
          {signal ? <SignalBadge signal={signal.signal} className="px-2 py-0.5 text-[10px]" /> : <span className="text-xs text-faint">—</span>}
        </td>
      ) : null}
    </tr>
  );
}

function Th({
  label,
  sortKey,
  sort,
  onSort,
  className,
  hint,
  align = "right",
}: {
  label: string;
  sortKey?: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  className?: string;
  hint?: string;
  align?: "left" | "right";
}) {
  const active = sortKey !== undefined && sort.key === sortKey;
  const content: ReactNode = (
    <>
      {active ? sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      {label}
      {hint ? (
        <span title={hint} className="text-faint">
          <Info className="size-3" />
        </span>
      ) : null}
    </>
  );
  return (
    <th
      scope="col"
      className={cn("px-3 py-3 text-xs font-semibold whitespace-nowrap text-fg", align === "right" ? "text-right" : "text-left", className)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      {sortKey ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cn("inline-flex items-center gap-1 outline-none hover:text-primary focus-visible:text-primary", align === "right" && "flex-row-reverse")}
        >
          {content}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">{content}</span>
      )}
    </th>
  );
}

function sortValue(coin: MarketCoin, key: SortKey): number | null {
  return key === "rank" ? coin.rank : coin[key];
}

export function MarketTable({
  coins,
  favorites,
  onToggleFavorite,
  signals,
  initialSort,
}: {
  coins: MarketCoin[];
  favorites: string[];
  onToggleFavorite: (symbol: string) => void;
  signals?: Map<string, SignalInfo>;
  initialSort?: Sort;
}) {
  const t = useT();
  const [sort, setSort] = useState<Sort>(initialSort ?? { key: "rank", dir: "asc" });
  const onSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "rank" ? "asc" : "desc" }));

  const rows = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...coins].sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      if (x === null && y === null) return 0;
      if (x === null) return 1; // unknown values always last
      if (y === null) return -1;
      return (x - y) * dir;
    });
  }, [coins, sort]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const showSignals = Boolean(signals && signals.size);
  // The backup price source has no 7-day history: drop the empty column instead of showing blanks.
  const showChart = useMemo(() => coins.some((c) => c.spark.length > 1), [coins]);
  const header: { label: MessageKey; key?: SortKey; className?: string; hint?: MessageKey; align?: "left" | "right" }[] = [
    { label: "table.price", key: "price" },
    { label: "table.1h", key: "change1h", className: "hidden lg:table-cell" },
    { label: "table.24h", key: "change24h" },
    { label: "table.7d", key: "change7d", className: "hidden md:table-cell" },
    { label: "table.marketCap", key: "marketCap", className: "hidden md:table-cell", hint: "table.marketCapHint" },
    { label: "table.volume", key: "volume24h", className: "hidden xl:table-cell", hint: "table.volumeHint" },
    { label: "table.supply", className: "hidden xl:table-cell", hint: "table.supplyHint" },
    ...(showChart ? [{ label: "table.chart" as const, className: "hidden lg:table-cell" }] : []),
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse sm:min-w-[640px]">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="sticky left-0 z-[1] w-8 bg-surface sm:static sm:w-10" aria-label={t("table.watchlist")} />
            <Th label="#" sortKey="rank" sort={sort} onSort={onSort} align="left" className="hidden w-10 sm:table-cell" />
            <Th label={t("table.name")} sort={sort} onSort={onSort} align="left" className="sticky left-8 z-[1] bg-surface sm:static" />
            {header.map((h) => (
              <Th
                key={h.label}
                label={t(h.label)}
                sortKey={h.key}
                sort={sort}
                onSort={onSort}
                className={h.className}
                hint={h.hint ? t(h.hint) : undefined}
                align={h.align}
              />
            ))}
            {showSignals ? <Th label={t("table.signal")} sort={sort} onSort={onSort} className="hidden lg:table-cell" hint={t("table.signalHint")} /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((coin) => (
            <Row
              key={coin.id}
              coin={coin}
              favorite={favoriteSet.has(coin.symbol)}
              signal={signals?.get(coin.symbol)}
              showSignals={showSignals}
              showChart={showChart}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="flex flex-col divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <span className="skeleton size-6 rounded-full" />
          <span className="skeleton h-4 w-32" />
          <span className="flex-1" />
          <span className="skeleton h-4 w-20" />
          <span className="skeleton hidden h-4 w-16 sm:block" />
          <span className="skeleton hidden h-4 w-28 md:block" />
          <span className="skeleton hidden h-8 w-36 lg:block" />
        </div>
      ))}
    </div>
  );
}
