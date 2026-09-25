import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, Sparkles, X } from "lucide-react";
import { analyzeChartAi, explainSimple, getCoinChart, getCoinExtras } from "@/lib/coin-detail";
import { getNews } from "@/lib/news";
import { AssetIcon } from "@/components/asset-icon";
import { CoinChart } from "@/components/coin-chart";
import type { CoinRow } from "@/lib/scan";
import { INTERVALS, type IntervalId, type Signal } from "@/lib/types";
import { formatPct, formatPrice, formatUsd, stripMd } from "@/lib/utils";

const SIGNAL_LABEL: Record<Signal, string> = { LONG: "лонг", SHORT: "шорт", WAIT: "ждать" };
const SIGNAL_BG: Record<Signal, string> = {
  LONG: "bg-long/15 text-long",
  SHORT: "bg-short/15 text-short",
  WAIT: "bg-wait/15 text-wait",
};
const AI_DIRECTION_LABEL: Record<Signal, string> = { LONG: "Покупать", SHORT: "Продавать", WAIT: "Ждать" };
const AI_DIRECTION_BG: Record<Signal, string> = {
  LONG: "bg-long/20 text-long",
  SHORT: "bg-short/20 text-short",
  WAIT: "bg-wait/20 text-wait",
};
const AI_DIRECTION_BAR: Record<Signal, string> = { LONG: "bg-long", SHORT: "bg-short", WAIT: "bg-wait" };

export function CoinDetail({
  row,
  interval,
  onClose,
}: {
  row: CoinRow;
  interval: IntervalId;
  onClose: () => void;
}) {
  const [chartInterval, setChartInterval] = useState<IntervalId>(interval);
  const [aiOpen, setAiOpen] = useState(false);
  const [simpleOpen, setSimpleOpen] = useState(false);

  const chart = useQuery({
    queryKey: ["coin-chart", row.base, chartInterval],
    queryFn: () => getCoinChart({ data: { base: row.base, interval: chartInterval } }),
    placeholderData:
      chartInterval === interval
        ? {
            price: row.price,
            change24h: row.change24h,
            rsi: row.rsi,
            trend: row.trend,
            signal: row.signal,
            confidence: row.confidence,
            reason: row.reason,
            candles: row.candles,
          }
        : undefined,
    staleTime: 30_000,
  });
  const live = chart.data ?? row;
  // getCoinChart resolves to null (not a thrown error) when there isn't enough
  // fresh candle data for this timeframe — falling back to `row` silently would
  // show the PREVIOUS interval's stale signal/RSI/candles as if they were current.
  const chartFailed = chart.data === null;

  const extras = useQuery({
    queryKey: ["coin-extras", row.base, chartInterval],
    queryFn: () => getCoinExtras({ data: { base: row.base, interval: chartInterval } }),
    staleTime: 30_000,
  });

  const ai = useQuery({
    queryKey: ["chart-ai", row.base, chartInterval],
    queryFn: () =>
      analyzeChartAi({
        data: {
          base: row.base,
          interval: chartInterval,
          price: live.price,
          rsi: live.rsi,
          trend: live.trend,
          signal: live.signal,
          change24h: live.change24h,
          technicalReason: live.reason,
        },
      }),
    enabled: aiOpen,
    staleTime: 180_000,
    retry: 0,
  });

  const simple = useQuery({
    queryKey: ["chart-ai-simple", row.base, chartInterval, ai.data && ai.data.ok ? ai.data.levels.verdict : null],
    queryFn: () =>
      explainSimple({
        data: {
          base: row.base,
          interval: chartInterval,
          direction: ai.data && ai.data.ok ? ai.data.levels.direction : "WAIT",
          verdict: ai.data && ai.data.ok ? ai.data.levels.verdict : "",
          reasons: ai.data && ai.data.ok ? ai.data.levels.reasons : [],
        },
      }),
    enabled: simpleOpen && Boolean(ai.data?.ok),
    staleTime: 180_000,
    retry: 0,
  });

  const news = useQuery({
    queryKey: ["coin-news", row.base],
    queryFn: () => getNews({ data: { base: row.base } }),
    staleTime: 120_000,
    retry: 0,
  });

  const buyRatio = extras.data?.buyRatio;
  const buyPct = typeof buyRatio === "number" ? Math.round(buyRatio * 100) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl bg-surface shadow-[var(--shadow-border)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <div className="flex items-center gap-2">
              <AssetIcon base={row.base} kind={row.kind} className="size-6" />
              <p className="font-display text-xl font-semibold tracking-tight text-fg">{row.base}</p>
              {chartFailed ? null : (
                <span className={`rounded-sm px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${SIGNAL_BG[live.signal]}`}>
                  {SIGNAL_LABEL[live.signal]}
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-2xl tabular-nums text-fg">{formatPrice(live.price)}</p>
            <p className={`font-mono text-xs tabular-nums ${live.change24h >= 0 ? "text-long" : "text-short"}`}>
              {formatPct(live.change24h)} · сутки
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-sm p-1.5 text-faint outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-faint">Хай 24ч</p>
              <p className="font-mono text-sm tabular-nums text-fg">
                {extras.data?.high24h ? formatPrice(extras.data.high24h) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-faint">Лоу 24ч</p>
              <p className="font-mono text-sm tabular-nums text-fg">
                {extras.data?.low24h ? formatPrice(extras.data.low24h) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-faint">Объём 24ч</p>
              <p className="font-mono text-sm tabular-nums text-fg">
                {extras.data?.volume ? formatUsd(extras.data.volume) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-faint">RSI</p>
              <p className="font-mono text-sm tabular-nums text-fg">{chartFailed ? "—" : live.rsi}</p>
            </div>
          </div>

          {buyPct !== null ? (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-faint">
                <span className="text-long">Покупатели {buyPct}%</span>
                <span className="text-short">Продавцы {100 - buyPct}%</span>
              </div>
              <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-long" style={{ width: `${buyPct}%` }} />
                <div className="h-full bg-short" style={{ width: `${100 - buyPct}%` }} />
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex gap-1 rounded-sm bg-surface-2 p-1">
            {INTERVALS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setChartInterval(item.id)}
                aria-pressed={chartInterval === item.id}
                className={`h-8 flex-1 rounded-sm px-2 font-mono text-xs outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  chartInterval === item.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-2">
            {chart.isLoading ? (
              <div className="h-[420px] w-full animate-pulse rounded-lg bg-surface-2" />
            ) : chartFailed ? (
              <div className="flex h-[420px] w-full flex-col items-center justify-center gap-3 rounded-lg bg-surface-2 p-4 text-center">
                <p className="text-sm text-muted">
                  Не удалось загрузить график на этом таймфрейме. Данные могут быть недоступны прямо сейчас.
                </p>
                <button
                  type="button"
                  onClick={() => void chart.refetch()}
                  className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Попробовать снова
                </button>
              </div>
            ) : (
              <CoinChart candles={live.candles} levels={aiOpen && ai.data?.ok ? ai.data.levels : null} />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => (aiOpen ? void ai.refetch() : setAiOpen(true))}
              disabled={ai.isFetching || chartFailed}
              className="flex h-9 items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-medium text-primary-fg outline-none transition-[opacity,transform] duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {ai.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {aiOpen ? "Обновить анализ ИИ" : "Анализ ИИ по графику"}
            </button>
            {aiOpen && ai.data && !ai.data.ok ? <span className="text-xs text-short">{ai.data.error}</span> : null}
          </div>

          {aiOpen && ai.isFetching ? <p className="mt-2 shimmer-text text-xs">ИИ смотрит график</p> : null}

          {aiOpen && ai.data?.ok ? (
            <div className="mt-3 overflow-hidden rounded-lg bg-surface-2">
              <div className={`flex items-center justify-between gap-3 px-3 py-2.5 ${AI_DIRECTION_BG[ai.data.levels.direction]}`}>
                <span className="font-display text-sm font-bold tracking-wide">{AI_DIRECTION_LABEL[ai.data.levels.direction]}</span>
                <span className="font-mono text-[11px] tabular-nums opacity-80">увер. {ai.data.levels.confidence}%</span>
              </div>
              <div className="w-full bg-surface">
                <div
                  className={`h-1 ${AI_DIRECTION_BAR[ai.data.levels.direction]}`}
                  style={{ width: `${ai.data.levels.confidence}%` }}
                />
              </div>
              <div className="p-3">
                <p className="text-sm leading-relaxed font-medium text-fg">{stripMd(ai.data.levels.verdict)}</p>

                {ai.data.levels.reasons.length ? (
                  <ul className="mt-2.5 flex flex-col gap-1.5">
                    {ai.data.levels.reasons.map((reason, i) => (
                      <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-muted">
                        <span className="mt-0.5 text-faint">•</span>
                        <span>{stripMd(reason)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {ai.data.levels.entry || ai.data.levels.stopLoss || ai.data.levels.target ? (
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-2.5">
                    <div>
                      <p className="text-[10px] text-faint uppercase">Вход</p>
                      <p className="font-mono text-xs tabular-nums text-fg">
                        {ai.data.levels.entry ? formatPrice(ai.data.levels.entry) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-faint uppercase">Стоп</p>
                      <p className="font-mono text-xs tabular-nums text-short">
                        {ai.data.levels.stopLoss ? formatPrice(ai.data.levels.stopLoss) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-faint uppercase">Цель</p>
                      <p className="font-mono text-xs tabular-nums text-long">
                        {ai.data.levels.target ? formatPrice(ai.data.levels.target) : "—"}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 border-t border-border pt-2.5">
                  <button
                    type="button"
                    onClick={() => (simpleOpen ? void simple.refetch() : setSimpleOpen(true))}
                    disabled={simple.isFetching}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-primary/80 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {simple.isFetching ? <Loader2 className="size-3 animate-spin" /> : <MessageCircle className="size-3" />}
                    Объясни проще
                  </button>
                  {simpleOpen && simple.isFetching ? <p className="mt-2 shimmer-text text-xs">Упрощаю объяснение</p> : null}
                  {simpleOpen && simple.data?.ok ? (
                    <p className="mt-2 text-xs leading-relaxed text-fg">{stripMd(simple.data.text)}</p>
                  ) : null}
                  {simpleOpen && simple.data && !simple.data.ok ? (
                    <p className="mt-2 text-xs text-short">{simple.data.error}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {chartFailed ? null : (
            <div className="mt-4 rounded-sm bg-surface-2 p-3">
              <p className="text-xs leading-relaxed text-muted">{live.reason}</p>
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs font-medium tracking-wide text-faint uppercase">Новости про {row.base}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {news.isLoading ? (
                <li className="h-12 animate-pulse rounded-sm bg-surface-2" />
              ) : news.data?.length ? (
                news.data.slice(0, 6).map((item) => (
                  <li key={item.title}>
                    <a
                      href={item.url || undefined}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block rounded-sm bg-surface-2 p-2.5 text-xs text-fg hover:text-fg/80"
                    >
                      {item.title}
                      <span className="mt-1 block text-[10px] text-faint">{item.source}</span>
                    </a>
                  </li>
                ))
              ) : (
                <li className="text-xs text-muted">Пока нет новостей про этот актив.</li>
              )}
            </ul>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-faint">
            Уровни и вывод ИИ — ориентир по графику и индикаторам, а не финансовая рекомендация.
          </p>
        </div>
      </div>
    </div>
  );
}
