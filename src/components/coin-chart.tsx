import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { AiLevels, Candle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";
import { useResolvedTheme } from "@/components/site/prefs";
import { chartPalette } from "@/lib/theme-colors";
import { addTickerWatermark, baseChartOptions, CANDLE_DOWN, CANDLE_UP, candleSeriesOptions, volumeColor } from "@/lib/candle-style";
import { CandleLegend, type LegendCandle } from "@/components/candle-legend";

const UP = CANDLE_UP;
const DOWN = CANDLE_DOWN;

const LEVEL_META: {
  key: "resistance" | "target" | "target2" | "entry" | "support" | "stopLoss";
  label: MessageKey;
  color: string;
}[] = [
  { key: "resistance", label: "ai.resistance", color: "#ff8f8f" },
  { key: "target2", label: "ai.target2", color: "#7ee0b0" },
  { key: "target", label: "ai.target", color: UP },
  { key: "entry", label: "ai.entry", color: "#b7bbff" },
  { key: "support", label: "ai.support", color: "#7ee0b0" },
  { key: "stopLoss", label: "ai.stop", color: DOWN },
];

/** One real candlestick chart — the AI's levels are drawn directly on it as price lines. */
export function CoinChart({
  candles,
  levels,
  symbol,
  className,
}: {
  candles: Candle[];
  levels?: AiLevels | null;
  /** Shown as a faint watermark behind the candles. */
  symbol?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const t = useT();
  const theme = useResolvedTheme();
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [legendRows, setLegendRows] = useState<LegendCandle[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      ...baseChartOptions(chartPalette()),
      width: container.clientWidth,
      height: container.clientHeight || 440,
    });
    const series = chart.addSeries(CandlestickSeries, candleSeriesOptions());
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: UP,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;
    setChartApi(chart);

    const resize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight || 440 });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      linesRef.current = [];
      setChartApi(null);
    };
  }, []);

  useEffect(() => {
    if (!chartApi) return;
    return addTickerWatermark(chartApi, symbol, chartPalette());
  }, [chartApi, symbol, theme]);

  // Follow the light/dark switch without rebuilding the chart.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions(baseChartOptions(chartPalette()));
  }, [theme]);

  useEffect(() => {
    const series = seriesRef.current;
    const volume = volumeRef.current;
    if (!series || !volume || !candles.length) return;
    const sorted = [...candles].sort((a, b) => a.t - b.t);
    const seen = new Set<UTCTimestamp>();
    const rows = sorted
      .map((c) => ({ time: Math.floor(c.t / 1000) as UTCTimestamp, open: c.o, high: c.h, low: c.l, close: c.c, v: c.v }))
      .filter((row) => {
        if (seen.has(row.time)) return false;
        seen.add(row.time);
        return true;
      });
    series.setData(rows.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    volume.setData(
      rows.map((row) => ({
        time: row.time,
        value: row.v,
        color: volumeColor(row.close >= row.open),
      })),
    );
    setLegendRows(rows.map((r) => ({ time: r.time, o: r.open, h: r.high, l: r.low, c: r.close, v: r.v })));
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const line of linesRef.current) series.removePriceLine(line);
    linesRef.current = [];
    if (!levels) return;
    for (const meta of LEVEL_META) {
      const value = levels[meta.key];
      if (typeof value !== "number") continue;
      linesRef.current.push(
        series.createPriceLine({
          price: value,
          color: meta.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: t(meta.label),
        }),
      );
    }
  }, [levels, t]);

  return (
    <div className={cn("relative h-[440px] w-full overflow-hidden rounded-xl bg-surface-2 shadow-[var(--shadow-border)]", className)}>
      <div ref={containerRef} className="absolute inset-0" />
      <CandleLegend chart={chartApi} rows={legendRows} />
    </div>
  );
}
