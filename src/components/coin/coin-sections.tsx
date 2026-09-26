import { useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Bot, CandlestickChart, ChevronDown, LineChart, Lock, Sparkles, TrendingUp } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RANGES, type CoinInfo, type RangeId } from "@/lib/coins";
import { pctSigned, usdPrice } from "@/lib/format";
import { formatDay, useT, type MessageKey } from "@/lib/i18n";
import { assetOf, TAPE_CRYPTOS } from "@/lib/markets";
import { useSettings } from "@/lib/settings-store";
import type { IntervalId } from "@/lib/types";
import { useHistory } from "@/lib/use-market";
import { cn } from "@/lib/utils";
import { Change } from "@/components/market/bits";
import { PriceChart } from "@/components/coin/price-chart";
import { CoinChart } from "@/components/coin-chart";
import { AiButton, AiResult, BuyersBar, CoinNews, IntervalTabs, TechnicalPanel, useCoinAnalysis } from "@/components/coin-detail";

export function Section({ title, icon, action, children, className }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const RANGE_LABEL: Record<RangeId, MessageKey> = {
  "1d": "range.1d",
  "7d": "range.7d",
  "1m": "range.1m",
  "3m": "range.3m",
  "1y": "range.1y",
  all: "range.all",
};

export function ChartSection({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const [range, setRange] = useState<RangeId>("7d");
  const [mode, setMode] = useState<"line" | "candles">("line");
  const history = useHistory(coin.id, coin.symbol, range, coin.price);
  const data = history.data;
  const canCandles = data?.source === "binance";
  const effectiveMode = canCandles ? mode : "line";
  const change = useMemo(() => {
    const pts = data?.points;
    if (!pts || pts.length < 2) return null;
    const first = pts[0]!.c;
    return first > 0 ? ((pts.at(-1)!.c - first) / first) * 100 : null;
  }, [data]);

  return (
    <Section
      title={t("coin.chart", { name: coin.name })}
      icon={<LineChart className="size-5 text-primary" />}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-surface-2 p-1" role="group" aria-label={t("coin.range")}>
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                aria-pressed={range === r.id}
                className={cn(
                  "h-7 rounded-lg px-2.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  range === r.id ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted hover:text-fg",
                )}
              >
                {t(RANGE_LABEL[r.id])}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl bg-surface-2 p-1" role="group" aria-label={t("coin.chartType")}>
            {(["line", "candles"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={m === "candles" && !canCandles}
                onClick={() => setMode(m)}
                aria-pressed={effectiveMode === m}
                title={t(m === "line" ? "coin.line" : "coin.candles")}
                aria-label={t(m === "line" ? "coin.line" : "coin.candles")}
                className={cn(
                  "grid h-7 w-8 place-items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-35",
                  effectiveMode === m ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted hover:text-fg",
                )}
              >
                {m === "line" ? <TrendingUp className="size-4" /> : <CandlestickChart className="size-4" />}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {change !== null ? (
        <p className="-mt-1 mb-2 text-xs text-muted">
          {t("coin.rangeChange", { range: t(RANGE_LABEL[range]) })} <Change value={change} className="text-xs" />
        </p>
      ) : null}
      {history.isLoading ? (
        <div className="skeleton h-[400px] w-full rounded-xl" />
      ) : data && data.points.length >= 2 ? (
        <div className={cn("transition-opacity", history.isFetching && "opacity-60")}>
          <PriceChart points={data.points} mode={effectiveMode} range={range} />
        </div>
      ) : (
        <div className="grid h-[400px] place-items-center rounded-xl bg-surface-2 p-6 text-center">
          <div>
            <p className="text-sm text-muted">{t("detail.chartFailed")}</p>
            <button type="button" onClick={() => void history.refetch()} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg">
              {t("common.retry")}
            </button>
          </div>
        </div>
      )}
      {data ? <p className="mt-2 text-[11px] text-faint">{t("coin.chartSource", { source: data.source === "binance" ? "Binance" : "CoinGecko" })}</p> : null}
    </Section>
  );
}

export function PerformanceRow({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const items: { label: MessageKey; value: number | null }[] = [
    { label: "perf.1h", value: coin.change1h },
    { label: "perf.24h", value: coin.change24h },
    { label: "perf.7d", value: coin.change7d },
    { label: "perf.30d", value: coin.change30d },
    { label: "perf.1y", value: coin.change1y },
  ];
  return (
    <div className="grid grid-cols-5 overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
      {items.map((item) => (
        <div key={item.label} className="border-r border-border px-2 py-3 text-center last:border-0">
          <p className="text-[11px] font-medium text-faint">{t(item.label)}</p>
          <Change value={item.value} className="mt-1 justify-center text-sm" digits={item.value !== null && Math.abs(item.value) >= 1000 ? 0 : 2} />
        </div>
      ))}
    </div>
  );
}

const SIGNAL_BASES: ReadonlySet<string> = new Set(TAPE_CRYPTOS);

/** Indicator signal + AI analysis for coins the scanner follows. */
export function SignalsSection({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const asset = SIGNAL_BASES.has(coin.symbol) ? assetOf(coin.symbol) : undefined;

  return (
    <Section title={t("coin.signals")} icon={<Sparkles className="size-5 text-primary" />}>
      {!asset ? (
        <p className="text-sm text-muted">{t("coin.noSignals", { n: TAPE_CRYPTOS.length })}</p>
      ) : isPending ? (
        <div className="skeleton h-40 w-full rounded-xl" />
      ) : !user ? (
        <div className="relative overflow-hidden rounded-xl bg-surface-2 p-5">
          <div className="pointer-events-none flex flex-col gap-2 opacity-40 blur-[3px] select-none" aria-hidden>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-long/20 px-3 py-1 text-xs font-bold text-long uppercase">{t("signal.LONG")}</span>
              <span className="h-2 w-40 rounded-full bg-long/40" />
            </div>
            <span className="h-3 w-3/4 rounded bg-surface-3" />
            <span className="h-3 w-2/3 rounded bg-surface-3" />
            <span className="h-3 w-1/2 rounded bg-surface-3" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Lock className="size-4 text-primary" />
              {t("coin.signalsLocked", { name: coin.name })}
            </p>
            <Link to="/login" search={{ mode: "signup", redirect: pathname }} className="bg-brand rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-glow)]">
              {t("gate.cta")}
            </Link>
          </div>
        </div>
      ) : (
        <MemberSignals base={asset.base} />
      )}
      {user ? <AskAi coin={coin} /> : null}
    </Section>
  );
}

/** Quick questions that open the AI chat with this coin's live data attached. */
function AskAi({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const questions: MessageKey[] = ["ask.q1", "ask.q2", "ask.q3"];
  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
        <Bot className="size-4 text-primary" />
        {t("ask.title", { name: coin.name })}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {questions.map((key) => (
          <Link
            key={key}
            to="/ai"
            search={{ q: t(key, { name: coin.name, symbol: coin.symbol }) }}
            className="rounded-xl bg-surface-2 px-3 py-2 text-xs font-medium text-fg hover:bg-surface-3"
          >
            {t(key, { name: coin.name, symbol: coin.symbol })}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MemberSignals({ base }: { base: string }) {
  const t = useT();
  const [timeframe, setTimeframe] = useState<IntervalId>("1h");
  const analysis = useCoinAnalysis(base, timeframe);
  const { chart, chartFailed, live, aiOpen, levels, buyPct } = analysis;
  return (
    <div className="flex flex-col gap-4">
      <IntervalTabs value={timeframe} onChange={setTimeframe} />
      {chart.isLoading ? (
        <div className="skeleton h-40 w-full rounded-xl" />
      ) : chartFailed || !live ? (
        <p className="text-sm text-muted">{t("detail.chartFailed")}</p>
      ) : (
        <>
          <TechnicalPanel live={live} />
          <BuyersBar buyPct={buyPct} />
        </>
      )}
      <AiButton analysis={analysis} />
      {aiOpen && levels && live && !analysis.ai.isFetching ? <CoinChart candles={live.candles} levels={levels} className="h-[360px]" /> : null}
      <AiResult analysis={analysis} />
      <p className="text-[11px] leading-relaxed text-faint">{t("detail.levelsNote")}</p>
    </div>
  );
}

export function AboutSection({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const [expanded, setExpanded] = useState(false);
  const paragraphs = coin.description.split(/\n{2,}/).filter(Boolean);
  const long = coin.description.length > 700;
  if (!paragraphs.length && !coin.categories.length && !coin.genesisDate) return null;
  return (
    <Section title={t("coin.about", { name: coin.name })} icon={<BarChart3 className="size-5 text-primary" />}>
      {paragraphs.length ? (
        <div>
          <div className="relative">
            <div className={cn("flex flex-col gap-3 text-sm leading-relaxed text-muted", !expanded && long && "max-h-44 overflow-hidden")}>
              {paragraphs.map((text, i) => (
                <p key={i} className="whitespace-pre-line">
                  {text}
                </p>
              ))}
            </div>
            {long && !expanded ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" /> : null}
          </div>
          {long ? (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 flex items-center gap-1 text-sm font-semibold text-primary hover:opacity-80">
              {t(expanded ? "coin.less" : "coin.more")}
              <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
            </button>
          ) : null}
          {lang !== "ru" && lang !== "en" ? <p className="mt-2 text-[11px] text-faint">{t("coin.aboutLang")}</p> : null}
        </div>
      ) : null}
      {coin.categories.length || coin.genesisDate ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {coin.genesisDate ? (
            <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-muted">
              {t("coin.genesis")}: <span className="font-semibold text-fg">{formatDay(lang, coin.genesisDate)}</span>
            </span>
          ) : null}
          {coin.categories.map((c) => (
            <span key={c} className="rounded-lg bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
              {c}
            </span>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

export function RecordsSection({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  if (coin.ath === null && coin.atl === null) return null;
  const rows = [
    { label: "coin.ath" as const, value: coin.ath, date: coin.athDate, change: coin.athChange },
    { label: "coin.atl" as const, value: coin.atl, date: coin.atlDate, change: coin.atlChange },
  ].filter((r) => r.value !== null);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs font-medium text-faint">{t(row.label)}</p>
          <p className="mt-1 font-display text-xl font-bold text-fg tabular-nums">{usdPrice(row.value)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {row.date ? <span>{formatDay(lang, row.date)}</span> : null}
            {row.change !== null ? (
              <span className={row.change >= 0 ? "text-long" : "text-short"}>
                {t("coin.fromNow", { pct: pctSigned(row.change, Math.abs(row.change) >= 1000 ? 0 : 2) })}
              </span>
            ) : null}
          </p>
        </div>
      ))}
    </div>
  );
}

export function NewsSection({ coin }: { coin: CoinInfo }) {
  const t = useT();
  const { user } = useCurrentUserState();
  if (!user) return null;
  return (
    <Section title={t("detail.newsAbout", { base: coin.name })}>
      <CoinNews base={coin.symbol} limit={6} />
    </Section>
  );
}
