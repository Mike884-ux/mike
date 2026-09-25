import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  LineChart,
  MessageCircle,
  Minus,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Wallet as WalletIcon,
} from "lucide-react";
import { getSentiment, scanMarket, type CoinRow } from "@/lib/scan";
import { INTERVALS, type IntervalId, type Signal } from "@/lib/types";
import { formatPct, formatPrice } from "@/lib/utils";
import type { AppUser } from "@/lib/auth/use-current-user";
import { AssetIcon } from "@/components/asset-icon";
import { useFavorites } from "@/lib/favorites-store";
import { Mark } from "@/components/mark";
import { Spark } from "@/components/spark";
import { UserButton } from "@/lib/auth/gates";
import { Wallet } from "@/components/wallet";
import { News } from "@/components/news";
import { Chat } from "@/components/chat";
import { CoinDetail } from "@/components/coin-detail";

const SIGNAL_LABEL: Record<Signal, string> = { LONG: "лонг", SHORT: "шорт", WAIT: "ждать" };
const SIGNAL_BG: Record<Signal, string> = {
  LONG: "bg-long/15 text-long",
  SHORT: "bg-short/15 text-short",
  WAIT: "bg-wait/15 text-wait",
};
const TREND_LABEL: Record<CoinRow["trend"], string> = { up: "вверх", down: "вниз", side: "боковик" };

const FNG_LABEL_RU: Record<string, string> = {
  "Extreme Fear": "Крайний страх",
  Fear: "Страх",
  Neutral: "Нейтрально",
  Greed: "Жадность",
  "Extreme Greed": "Крайняя жадность",
};
function fngTone(value: number) {
  if (value <= 25) return "text-short";
  if (value <= 45) return "text-wait";
  if (value <= 55) return "text-muted";
  if (value <= 75) return "text-long";
  return "text-long";
}
function FearGreedGauge({ value }: { value: number }) {
  const angleDeg = 180 - (Math.max(0, Math.min(100, value)) / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;
  const tipX = 60 + 38 * Math.cos(angleRad);
  const tipY = 60 - 38 * Math.sin(angleRad);
  return (
    <svg viewBox="0 0 120 68" className="h-14 w-24 shrink-0">
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

type SortKey = "price" | "change24h" | "rsi" | "confidence";

const TABS = [
  { id: "scan", label: "Сканер", icon: LineChart },
  { id: "wallet", label: "Кошелёк", icon: WalletIcon },
  { id: "news", label: "Новости", icon: Newspaper },
  { id: "chat", label: "Чат с ИИ", icon: MessageCircle },
] as const;
type TabId = (typeof TABS)[number]["id"];

function CoinRowView({
  row,
  rank,
  favorite,
  onOpenDetail,
  onToggleFavorite,
}: {
  row: CoinRow;
  rank: number;
  favorite: boolean;
  onOpenDetail: () => void;
  onToggleFavorite: () => void;
}) {
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
        if (event.key === "Enter" || event.key === " ") onOpenDetail();
      }}
      className={`cursor-pointer border-b border-border/60 outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2 ${
        rank % 2 === 0 ? "bg-surface-2/30" : ""
      }`}
    >
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          onKeyDown={(event) => event.stopPropagation()}
          aria-pressed={favorite}
          aria-label="В избранное"
          className="flex size-5 items-center justify-center text-faint outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-wait focus-visible:text-wait"
        >
          <Star className={`size-3.5 ${favorite ? "fill-wait text-wait" : ""}`} />
        </button>
      </td>
      <td className="px-3 py-2.5">
        <span className="flex size-5 items-center justify-center rounded-full bg-surface-2 font-mono text-[10px] text-faint">
          {rank}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <AssetIcon base={row.base} kind={row.kind} />
          <span className="font-mono text-sm font-semibold text-fg">{row.base}</span>
        </div>
      </td>
      <td
        className={`px-3 py-2.5 text-right font-mono text-sm tabular-nums text-fg transition-colors duration-700 ease-out ${
          flash === "up" ? "bg-long/25" : flash === "down" ? "bg-short/25" : ""
        }`}
      >
        {formatPrice(row.price)}
      </td>
      <td
        className={`px-3 py-2.5 text-right font-mono text-xs tabular-nums ${row.change24h >= 0 ? "text-long" : "text-short"}`}
      >
        <span className="inline-flex items-center gap-0.5">
          {row.change24h >= 0 ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
          {Math.abs(row.change24h).toFixed(2)}%
        </span>
      </td>
      <td className="hidden px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted sm:table-cell">{row.rsi}</td>
      <td className="hidden px-3 py-2.5 sm:table-cell">
        <span className={`flex items-center gap-1 text-xs ${row.trend === "up" ? "text-long" : row.trend === "down" ? "text-short" : "text-faint"}`}>
          <TrendIcon className="size-3" />
          {TREND_LABEL[row.trend]}
        </span>
      </td>
      <td className="hidden px-3 py-2.5 md:table-cell">
        <Spark candles={row.candles} className="h-8 w-20" />
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-block rounded-sm px-2 py-1 text-xs font-medium uppercase tracking-wide ${SIGNAL_BG[row.signal]}`}>
          {SIGNAL_LABEL[row.signal]}
        </span>
      </td>
      <td className="hidden px-3 py-2.5 text-right lg:table-cell">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums ${SIGNAL_BG[row.signal]}`}>
          {row.signal === "LONG" ? (
            <ArrowUp className="size-2.5" />
          ) : row.signal === "SHORT" ? (
            <ArrowDown className="size-2.5" />
          ) : (
            <Minus className="size-2.5" />
          )}
          {row.confidence}%
        </span>
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
    <th className={`px-3 py-2.5 text-right font-normal ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-fg focus-visible:text-fg ${active ? "text-fg" : "text-faint"}`}
      >
        {label}
        {active ? sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </button>
    </th>
  );
}

const CATEGORIES = [
  { id: "all", label: "Всё" },
  { id: "crypto", label: "Крипто" },
  { id: "stock", label: "Акции" },
] as const;
type CategoryId = (typeof CATEGORIES)[number]["id"];

function ScanTab() {
  const [interval, setInterval] = useState<IntervalId>("1h");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId>("all");
  const [selected, setSelected] = useState<CoinRow | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const favorites = useFavorites((s) => s.favorites);
  const toggleFavorite = useFavorites((s) => s.toggleFavorite);

  const scan = useQuery({
    queryKey: ["scan", interval],
    queryFn: () => scanMarket({ data: { interval } }),
    staleTime: 15_000,
    refetchInterval: 20_000,
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
    if (needle) list = list.filter((row) => row.base.includes(needle));
    if (sort) {
      list = [...list].sort((a, b) => (sort.dir === "asc" ? a[sort.key] - b[sort.key] : b[sort.key] - a[sort.key]));
    }
    return list;
  }, [scan.data, query, category, favoritesOnly, favorites, sort]);

  const topMovers = useMemo(() => [...(scan.data ?? [])].sort((a, b) => b.change24h - a.change24h).slice(0, 5), [scan.data]);

  const longCount = rows.filter((r) => r.signal === "LONG").length;
  const shortCount = rows.filter((r) => r.signal === "SHORT").length;
  const waitCount = rows.length - longCount - shortCount;
  const stats = [
    { label: "Активов", value: rows.length, tone: "text-fg", accent: "bg-border" },
    { label: "Лонг", value: longCount, tone: "text-long", accent: "bg-long" },
    { label: "Шорт", value: shortCount, tone: "text-short", accent: "bg-short" },
    { label: "Ждать", value: waitCount, tone: "text-wait", accent: "bg-wait" },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">Сканер рынка</h1>
          <p className="mt-1 text-sm text-muted">
            {scan.isLoading ? (
              <span className="shimmer-text">Считаю индикаторы</span>
            ) : (
              "сигнал по чистым индикаторам, без ИИ — открой монету для разбора с ИИ"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void scan.refetch()}
          disabled={scan.isFetching}
          className="flex h-9 items-center gap-1.5 rounded-sm bg-surface-2 px-3 text-xs text-muted outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-fg disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {scan.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Обновить
        </button>
      </div>

      {sentiment.data || topMovers.length ? (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {sentiment.data ? (
            <div className="flex items-center gap-3 rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
              <FearGreedGauge value={sentiment.data.value} />
              <div className="shrink-0">
                <p className="text-[11px] text-faint">Индекс страха и жадности</p>
                <p className={`font-mono text-lg font-semibold tabular-nums ${fngTone(sentiment.data.value)}`}>
                  {sentiment.data.value} · {FNG_LABEL_RU[sentiment.data.label] ?? sentiment.data.label}
                </p>
              </div>
            </div>
          ) : null}

          {topMovers.length ? (
            <div className="rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
              <p className="text-[11px] text-faint">Топ движения</p>
              <div className="mt-1.5 flex flex-col">
                {topMovers.map((row) => (
                  <button
                    key={row.symbol}
                    type="button"
                    onClick={() => setSelected(row)}
                    className="flex items-center justify-between gap-2 rounded-sm px-1 py-1 text-left outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <span className="flex items-center gap-1.5 text-xs">
                      <AssetIcon base={row.base} kind={row.kind} className="size-5" />
                      <span className="font-mono font-semibold text-fg">{row.base}</span>
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 font-mono text-xs tabular-nums ${row.change24h >= 0 ? "text-long" : "text-short"}`}
                    >
                      {row.change24h >= 0 ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
                      {Math.abs(row.change24h).toFixed(2)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5 rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
            <span className={`h-8 w-1 shrink-0 rounded-full ${s.accent}`} />
            <div>
              <p className="text-[11px] text-faint">{s.label}</p>
              <p className={`font-mono text-lg font-semibold tabular-nums ${s.tone}`}>{scan.isLoading ? "—" : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-surface p-2 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between">
        <div className="relative order-1 sm:order-2">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск монеты"
            className="h-9 w-full rounded-sm bg-surface-2 pr-3 pl-8 text-xs text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/30 sm:w-40"
          />
        </div>
        <div className="order-2 flex flex-wrap items-center gap-2 sm:order-1">
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-pressed={favoritesOnly}
            className={`flex h-8 items-center gap-1.5 rounded-sm px-3 text-xs outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-primary/30 ${
              favoritesOnly ? "bg-wait/20 text-wait" : "bg-surface-2 text-muted hover:text-fg"
            }`}
          >
            <Star className={`size-3.5 ${favoritesOnly ? "fill-wait" : ""}`} />
            Избранное
          </button>
          <div className="flex gap-1 rounded-sm bg-surface-2 p-1">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                aria-pressed={category === item.id}
                className={`h-8 rounded-sm px-3 text-xs outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  category === item.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-sm bg-surface-2 p-1">
            {INTERVALS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setInterval(item.id)}
                aria-pressed={interval === item.id}
                className={`h-8 rounded-sm px-3 font-mono text-xs outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  interval === item.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {scan.isLoading ? (
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : rows.length ? (
        <div className="mt-6 overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border text-left text-xs text-faint">
                <th className="px-3 py-2.5 font-normal"></th>
                <th className="px-3 py-2.5 font-normal">#</th>
                <th className="px-3 py-2.5 font-normal">Актив</th>
                <SortTh label="Цена" sortKey="price" sort={sort} onSort={toggleSort} />
                <SortTh label="24ч" sortKey="change24h" sort={sort} onSort={toggleSort} />
                <SortTh label="RSI" sortKey="rsi" sort={sort} onSort={toggleSort} className="hidden sm:table-cell" />
                <th className="hidden px-3 py-2.5 font-normal sm:table-cell">Тренд</th>
                <th className="hidden px-3 py-2.5 font-normal md:table-cell">График</th>
                <th className="px-3 py-2.5 font-normal">Сигнал</th>
                <SortTh label="Увер." sortKey="confidence" sort={sort} onSort={toggleSort} className="hidden lg:table-cell" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <CoinRowView
                  key={row.symbol}
                  row={row}
                  rank={i + 1}
                  favorite={favorites.includes(row.base)}
                  onOpenDetail={() => setSelected(row)}
                  onToggleFavorite={() => toggleFavorite(row.base)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">
          {scan.isError
            ? "Рынок сейчас не отвечает. Обнови страницу."
            : favoritesOnly
              ? "В избранном пока пусто — нажми на звёздочку у монеты, чтобы добавить."
              : "Ничего не нашлось."}
        </p>
      )}
      <div className="pb-6" />

      {selected ? <CoinDetail row={selected} interval={interval} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

export function Scanner({ account }: { account: AppUser }) {
  const [tab, setTab] = useState<TabId>("scan");
  void account;

  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex items-center gap-2.5">
          <Mark className="size-7" />
          <p className="font-display text-sm font-semibold tracking-tight text-fg">Скан</p>
          <span
            title="Сайт, дизайн и ИИ-анализ сделаны с помощью искусственного интеллекта (Claude + Gemini)"
            className="hidden items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary sm:flex"
          >
            <Sparkles className="size-2.5" />
            создано ИИ
          </span>
        </div>
        <nav className="flex gap-1 rounded-sm bg-surface-2 p-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-pressed={tab === item.id}
                className={`flex h-8 items-center gap-1.5 rounded-sm px-3 text-xs outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  tab === item.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
                }`}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <UserButton />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === "scan" ? (
          <ScanTab />
        ) : tab === "wallet" ? (
          <Wallet />
        ) : tab === "news" ? (
          <News />
        ) : (
          <Chat />
        )}
      </div>
    </div>
  );
}
