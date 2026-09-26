import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, History, Layers, Loader2, MessageCircle, Sparkles, X } from "lucide-react";
import { analyzeChartAi, explainSimple, getCoinChart, getCoinExtras } from "@/lib/coin-detail";
import { getNews } from "@/lib/news";
import { timeAgo, useT, type MessageKey } from "@/lib/i18n";
import { useSettings } from "@/lib/settings-store";
import { AssetIcon } from "@/components/asset-icon";
import { CoinChart } from "@/components/coin-chart";
import { ScoreBar, SignalBadge } from "@/components/ui-bits";
import { AiFailure } from "@/components/billing/upsell";
import type { CoinRow } from "@/lib/scan";
import { INTERVALS, type IntervalId, type Signal } from "@/lib/types";
import { formatPct, formatPrice, formatUsd, stripMd } from "@/lib/utils";

const AI_DIRECTION_BG: Record<Signal, string> = {
  LONG: "bg-long/15 text-long",
  SHORT: "bg-short/15 text-short",
  WAIT: "bg-wait/15 text-wait",
};
const AI_DIRECTION_BAR: Record<Signal, string> = { LONG: "bg-long", SHORT: "bg-short", WAIT: "bg-wait" };

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-[11px] text-faint">{label}</p>
      <p className={`font-mono text-sm tabular-nums ${tone ?? "text-fg"}`}>{value}</p>
    </div>
  );
}

function Level({ label, value, tone }: { label: string; value?: number; tone?: string }) {
  if (value === undefined) return null;
  return (
    <div className="rounded-lg bg-surface px-2.5 py-2 shadow-[var(--shadow-border)]">
      <p className="text-[10px] tracking-wide text-faint uppercase">{label}</p>
      <p className={`font-mono text-xs tabular-nums ${tone ?? "text-fg"}`}>{formatPrice(value)}</p>
    </div>
  );
}

/**
 * Everything the indicator + AI views need for one asset on one timeframe:
 * candles and signal, 24h stats, and the AI analysis (fetched on demand).
 */
export function useCoinAnalysis(base: string, interval: IntervalId) {
  const lang = useSettings((s) => s.lang);
  const [aiOpen, setAiOpen] = useState(false);
  const [simpleOpen, setSimpleOpen] = useState(false);

  const chart = useQuery({
    queryKey: ["coin-chart", base, interval],
    queryFn: () => getCoinChart({ data: { base, interval } }),
    staleTime: 30_000,
  });
  // A thrown request (network down) leaves `data` undefined too.
  const chartFailed = chart.data === null || (chart.isError && !chart.data);
  const live = chart.data ?? null;

  const extras = useQuery({
    queryKey: ["coin-extras", base, interval],
    queryFn: () => getCoinExtras({ data: { base, interval } }),
    staleTime: 30_000,
  });

  const ai = useQuery({
    queryKey: ["chart-ai", base, interval, lang],
    queryFn: () => analyzeChartAi({ data: { base, interval, lang } }),
    enabled: aiOpen,
    staleTime: 180_000,
    retry: 0,
  });
  const levels = ai.data?.ok ? ai.data.levels : null;

  const simple = useQuery({
    queryKey: ["chart-ai-simple", base, interval, lang, levels?.verdict ?? null],
    queryFn: () =>
      explainSimple({
        data: {
          base,
          interval,
          direction: levels?.direction ?? "WAIT",
          verdict: levels?.verdict ?? "",
          reasons: levels?.reasons ?? [],
          lang,
        },
      }),
    enabled: simpleOpen && Boolean(levels),
    staleTime: 180_000,
    retry: 0,
  });

  const buyRatio = extras.data?.buyRatio;
  const buyPct = typeof buyRatio === "number" ? Math.round(buyRatio * 100) : null;

  return { chart, chartFailed, live, extras, ai, aiOpen, setAiOpen, levels, simple, simpleOpen, setSimpleOpen, buyPct };
}

export type CoinAnalysis = ReturnType<typeof useCoinAnalysis>;

export function IntervalTabs({ value, onChange, className }: { value: IntervalId; onChange: (id: IntervalId) => void; className?: string }) {
  return (
    <div className={`flex gap-1 rounded-lg bg-surface-2 p-1 ${className ?? ""}`}>
      {INTERVALS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-pressed={value === item.id}
          className={`h-8 flex-1 rounded-md px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            value === item.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
          }`}
        >
          {item.id}
        </button>
      ))}
    </div>
  );
}

export function BuyersBar({ buyPct }: { buyPct: number | null }) {
  const t = useT();
  if (buyPct === null) return null;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-long">{t("detail.buyers", { n: buyPct })}</span>
        <span className="text-short">{t("detail.sellers", { n: 100 - buyPct })}</span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-long" style={{ width: `${buyPct}%` }} />
        <div className="h-full bg-short" style={{ width: `${100 - buyPct}%` }} />
      </div>
    </div>
  );
}

/** Score, higher-timeframe trend, backtest and the factors behind the signal. */
export function TechnicalPanel({ live }: { live: NonNullable<CoinAnalysis["live"]> }) {
  const t = useT();
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1.3fr]">
      <div className="flex flex-col gap-2">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] text-faint">{t("detail.strength")}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <ScoreBar score={live.score} />
            <SignalBadge signal={live.signal} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="flex items-center gap-1 text-[11px] text-faint">
              <Layers className="size-3" />
              {t("detail.higherTf", { tf: live.higherTf?.interval ?? "—" })}
            </p>
            <p className={`mt-1 text-sm ${live.higherTf?.trend === "up" ? "text-long" : live.higherTf?.trend === "down" ? "text-short" : "text-muted"}`}>
              {live.higherTf ? t(`trend.${live.higherTf.trend}` as MessageKey) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="flex items-center gap-1 text-[11px] text-faint">
              <History className="size-3" />
              {t("detail.backtest")}
            </p>
            {live.backtest.trades >= 5 ? (
              <>
                <p className={`mt-1 font-mono text-sm ${live.backtest.hitRate >= 55 ? "text-long" : live.backtest.hitRate >= 45 ? "text-wait" : "text-short"}`}>
                  {live.backtest.hitRate}%
                </p>
                <p className="text-[10px] text-faint">{t("detail.backtestText", { wins: live.backtest.wins, trades: live.backtest.trades })}</p>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted">{t("detail.backtestNone")}</p>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-xl bg-surface-2 p-3">
        <p className="text-[11px] text-faint">{t("detail.factors")}</p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {live.factors.slice(0, 7).map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-fg">
                {t(`factor.${f.key}` as MessageKey)}
                {f.value !== undefined ? <span className="ml-1 font-mono text-faint">{f.value}</span> : null}
              </span>
              {f.weight !== 0 ? (
                <span className={`font-mono tabular-nums ${f.weight > 0 ? "text-long" : "text-short"}`}>
                  {f.weight > 0 ? "+" : ""}
                  {f.weight}
                </span>
              ) : (
                <span className="text-faint">×</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-border pt-2 font-mono text-[10px] text-faint">
          ADX {live.technicals.adx} · Stoch {live.technicals.stochK} · %B {live.technicals.bbPercentB} · ATR {live.technicals.atrPct}% · Vol{" "}
          {live.technicals.volumeRatio}×
        </p>
      </div>
    </div>
  );
}

/** "Deep AI analysis" button with its thinking state and error text. */
export function AiButton({ analysis }: { analysis: CoinAnalysis }) {
  const t = useT();
  const { ai, aiOpen, setAiOpen, levels, chartFailed } = analysis;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => (aiOpen ? void ai.refetch() : setAiOpen(true))}
          disabled={ai.isFetching || chartFailed}
          className="bg-brand flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-[var(--shadow-glow)] hover:opacity-95 disabled:opacity-60"
        >
          {ai.isFetching ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {aiOpen && levels ? t("ai.reanalyze") : t("ai.analyze")}
        </button>
        {aiOpen && ai.data && !ai.data.ok && !ai.isFetching ? <AiFailure reason={ai.data.reason} /> : null}
        {aiOpen && ai.isError && !ai.isFetching ? <span className="text-xs text-short">{t("aiErr.unavailable")}</span> : null}
      </div>
      {aiOpen && ai.isFetching ? (
        <div className="rounded-xl bg-surface-2 p-4">
          <p className="shimmer-text text-sm">{t("ai.thinking")}</p>
          <p className="mt-1 text-xs text-faint">{t("ai.thinkingHint")}</p>
        </div>
      ) : null}
    </div>
  );
}

/** The AI verdict: direction, levels, reasoning, scenarios and a plain-words version. */
export function AiResult({ analysis }: { analysis: CoinAnalysis }) {
  const t = useT();
  const { aiOpen, levels, ai, simple, simpleOpen, setSimpleOpen } = analysis;
  if (!aiOpen || !levels || ai.isFetching) return null;
  return (
    <div className="fade-up overflow-hidden rounded-xl bg-surface-2">
      <div className={`flex items-center justify-between gap-3 px-4 py-3 ${AI_DIRECTION_BG[levels.direction]}`}>
        <span className="font-display text-base font-bold">{t(`action.${levels.direction}` as MessageKey)}</span>
        <span className="font-mono text-xs tabular-nums">{t("ai.confidence", { n: levels.confidence })}</span>
      </div>
      <div className="h-1 w-full bg-surface-3">
        <div className={`h-1 ${AI_DIRECTION_BAR[levels.direction]}`} style={{ width: `${levels.confidence}%` }} />
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-base leading-relaxed font-medium text-fg">{stripMd(levels.verdict)}</p>
          <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${levels.agreesWithIndicators ? "text-long" : "text-wait"}`}>
            {levels.agreesWithIndicators ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
            {t(levels.agreesWithIndicators ? "ai.agrees" : "ai.disagrees")}
          </p>
        </div>

        {levels.entry || levels.stopLoss || levels.target || levels.support || levels.resistance ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Level label={t("ai.entry")} value={levels.entry} />
            <Level label={t("ai.stop")} value={levels.stopLoss} tone="text-short" />
            <Level label={t("ai.target")} value={levels.target} tone="text-long" />
            <Level label={t("ai.target2")} value={levels.target2} tone="text-long" />
            <Level label={t("ai.support")} value={levels.support} />
            <Level label={t("ai.resistance")} value={levels.resistance} />
            {levels.riskReward ? (
              <div className="rounded-lg bg-surface px-2.5 py-2 shadow-[var(--shadow-border)]">
                <p className="text-[10px] tracking-wide text-faint uppercase">{t("ai.rr")}</p>
                <p className={`font-mono text-xs ${levels.riskReward >= 2 ? "text-long" : levels.riskReward >= 1 ? "text-wait" : "text-short"}`}>
                  1 : {levels.riskReward}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {levels.summary ? (
          <div>
            <p className="text-[11px] tracking-wide text-faint uppercase">{t("ai.summary")}</p>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted">{stripMd(levels.summary)}</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {levels.reasons.length ? (
            <div>
              <p className="text-[11px] tracking-wide text-faint uppercase">{t("ai.reasons")}</p>
              <ul className="mt-1 flex flex-col gap-1.5">
                {levels.reasons.map((reason, i) => (
                  <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-fg">
                    <span className="text-accent">•</span>
                    <span>{stripMd(reason)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {levels.risks.length ? (
            <div>
              <p className="text-[11px] tracking-wide text-faint uppercase">{t("ai.risks")}</p>
              <ul className="mt-1 flex flex-col gap-1.5">
                {levels.risks.map((risk, i) => (
                  <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-fg">
                    <span className="text-short">!</span>
                    <span>{stripMd(risk)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {levels.bullCase ? (
            <div className="rounded-lg bg-long/10 p-3">
              <p className="text-[11px] text-long">{t("ai.bull")}</p>
              <p className="mt-1 text-xs leading-relaxed text-fg">{stripMd(levels.bullCase)}</p>
            </div>
          ) : null}
          {levels.bearCase ? (
            <div className="rounded-lg bg-short/10 p-3">
              <p className="text-[11px] text-short">{t("ai.bear")}</p>
              <p className="mt-1 text-xs leading-relaxed text-fg">{stripMd(levels.bearCase)}</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {levels.invalidation ? (
            <p className="text-muted">
              <span className="text-faint">{t("ai.invalidation")}: </span>
              {stripMd(levels.invalidation)}
            </p>
          ) : null}
          {levels.horizon ? (
            <p className="text-muted">
              <span className="text-faint">{t("ai.horizon")}: </span>
              {stripMd(levels.horizon)}
            </p>
          ) : null}
        </div>

        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => (simpleOpen ? void simple.refetch() : setSimpleOpen(true))}
            disabled={simple.isFetching}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-60"
          >
            {simple.isFetching ? <Loader2 className="size-3 animate-spin" /> : <MessageCircle className="size-3" />}
            {t("ai.simple")}
          </button>
          {simpleOpen && simple.isFetching ? <p className="mt-2 shimmer-text text-xs">{t("ai.simplifying")}</p> : null}
          {simpleOpen && simple.data?.ok && !simple.isFetching ? <p className="mt-2 text-sm leading-relaxed text-fg">{stripMd(simple.data.text)}</p> : null}
          {simpleOpen && simple.data && !simple.data.ok && !simple.isFetching ? (
            <AiFailure reason={simple.data.reason} className="mt-2" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Latest headlines about one asset, with the AI's tone dot. */
export function CoinNews({ base, limit = 6 }: { base: string; limit?: number }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const news = useQuery({
    queryKey: ["coin-news", base, lang],
    queryFn: () => getNews({ data: { base, lang } }),
    staleTime: 120_000,
    retry: 0,
  });
  return (
    <ul className="flex flex-col gap-2">
      {news.isLoading ? (
        <li className="skeleton h-12" />
      ) : news.data?.length ? (
        news.data.slice(0, limit).map((item) => (
          <li key={item.url || item.title}>
            <a
              href={item.url || undefined}
              target="_blank"
              rel="noreferrer noopener"
              className="block rounded-lg bg-surface-2 p-2.5 text-sm text-fg hover:bg-surface-3"
            >
              {item.tone ? (
                <span
                  className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${item.tone === "bull" ? "bg-long" : item.tone === "bear" ? "bg-short" : "bg-faint"}`}
                  aria-label={t(`news.tone.${item.tone}` as MessageKey)}
                />
              ) : null}
              {item.title}
              <span className="mt-1 block text-[11px] text-faint">
                {item.source}
                {item.publishedAt ? ` · ${timeAgo(lang, item.publishedAt)}` : ""}
              </span>
            </a>
          </li>
        ))
      ) : (
        <li className="text-xs text-muted">{t("detail.noNews")}</li>
      )}
    </ul>
  );
}

/** Pop-up analysis for one row of the signals page. */
export function CoinDetail({ row, interval, onClose }: { row: CoinRow; interval: IntervalId; onClose: () => void }) {
  const t = useT();
  const [chartInterval, setChartInterval] = useState<IntervalId>(interval);
  const analysis = useCoinAnalysis(row.base, chartInterval);
  const { chart, chartFailed, live, extras, aiOpen, levels, buyPct } = analysis;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const price = live?.price ?? row.price;
  const change = live?.change24h ?? row.change24h;
  const signal = live?.signal ?? row.signal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("detail.dialog", { base: row.base })}
    >
      <div className="fade-up w-full max-w-4xl rounded-2xl bg-bg shadow-[var(--shadow-pop)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <div className="flex items-center gap-2">
              <AssetIcon base={row.base} kind={row.kind} className="size-7" />
              <p className="font-display text-xl font-bold text-fg">{row.base}</p>
              {chartFailed ? null : <SignalBadge signal={signal} />}
            </div>
            <p className="mt-1 font-mono text-2xl tabular-nums text-fg">{formatPrice(price)}</p>
            <p className={`font-mono text-xs tabular-nums ${change >= 0 ? "text-long" : "text-short"}`}>
              {formatPct(change)} · {t("detail.day")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-lg p-1.5 text-faint outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[82vh] overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t("detail.high")} value={extras.data?.high24h ? formatPrice(extras.data.high24h) : "—"} />
            <Stat label={t("detail.low")} value={extras.data?.low24h ? formatPrice(extras.data.low24h) : "—"} />
            <Stat label={t("detail.volume")} value={extras.data?.volume ? formatUsd(extras.data.volume) : "—"} />
            <Stat label="RSI" value={live ? String(live.technicals.rsi) : "—"} />
          </div>

          <div className="mt-3">
            <BuyersBar buyPct={buyPct} />
          </div>

          <IntervalTabs value={chartInterval} onChange={setChartInterval} className="mt-4" />

          <div className="mt-2">
            {chart.isLoading ? (
              <div className="skeleton h-[420px] w-full rounded-xl" />
            ) : chartFailed || !live ? (
              <div className="flex h-[420px] w-full flex-col items-center justify-center gap-3 rounded-xl bg-surface-2 p-4 text-center">
                <p className="text-sm text-muted">{t("detail.chartFailed")}</p>
                <button type="button" onClick={() => void chart.refetch()} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg">
                  {t("common.retry")}
                </button>
              </div>
            ) : (
              <CoinChart candles={live.candles} levels={aiOpen && levels ? levels : null} />
            )}
          </div>

          {live && !chartFailed ? (
            <div className="mt-3">
              <TechnicalPanel live={live} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3">
            <AiButton analysis={analysis} />
            <AiResult analysis={analysis} />
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">{t("detail.newsAbout", { base: row.base })}</p>
            <CoinNews base={row.base} />
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-faint">{t("detail.levelsNote")}</p>
        </div>
      </div>
    </div>
  );
}
