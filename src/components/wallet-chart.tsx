import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AreaSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { getPortfolioHistory, PORTFOLIO_PERIODS, type PortfolioPeriod } from "@/lib/wallet";
import { formatPct, formatUsd } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";

function Chart({ points }: { points: { t: number; value: number }[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      layout: { background: { color: "transparent" }, textColor: "#8f98b3", attributionLogo: false },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)" },
      width: container.clientWidth,
      height: container.clientHeight || 260,
    });
    const series = chart.addSeries(AreaSeries, { lineWidth: 2 });
    chartRef.current = chart;
    seriesRef.current = series;

    const resize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight || 260 });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !points.length) return;
    const up = (points.at(-1)?.value ?? 0) >= (points[0]?.value ?? 0);
    const color = up ? "#2fd08a" : "#ff6b6b";
    series.applyOptions({ lineColor: color, topColor: `${color}33`, bottomColor: `${color}00` });
    series.setData(points.map((p) => ({ time: Math.floor(p.t / 1000) as UTCTimestamp, value: p.value })));
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  return <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-lg bg-surface-2" />;
}

export function WalletChart({ positions }: { positions: { symbol: string; qty: number }[] }) {
  const t = useT();
  const [period, setPeriod] = useState<PortfolioPeriod>("30d");

  const history = useQuery({
    queryKey: ["portfolio-history", positions.map((p) => `${p.symbol}:${p.qty}`).join(","), period],
    queryFn: () => getPortfolioHistory({ data: { positions, period } }),
    enabled: positions.length > 0,
    staleTime: 60_000,
  });

  const points = history.data ?? [];
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  const delta = first && last ? last - first : null;
  const deltaPct = first && last && first > 0 ? ((last - first) / first) * 100 : null;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-faint uppercase">{t("wallet.historyTitle")}</p>
        <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
          {PORTFOLIO_PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              aria-pressed={period === item.id}
              className={`h-7 rounded-sm px-2.5 font-mono text-xs outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-primary/30 ${
                period === item.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
              }`}
            >
              {t(`period.${item.id}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>

      {delta !== null && deltaPct !== null ? (
        <p className={`mt-1 font-mono text-xs tabular-nums ${delta >= 0 ? "text-long" : "text-short"}`}>
          {t("wallet.periodChange", { delta: `${delta >= 0 ? "+" : ""}${formatUsd(delta)}`, pct: formatPct(deltaPct) })}
        </p>
      ) : null}

      <div className="mt-2">
        {history.isLoading ? (
          <div className="h-56 w-full animate-pulse rounded-lg bg-surface-2" />
        ) : points.length > 1 ? (
          <Chart points={points} />
        ) : (
          <p className="py-8 text-center text-xs text-muted">
            {history.isError ? t("wallet.historyError") : t("wallet.noHistory")}
          </p>
        )}
      </div>
    </div>
  );
}
