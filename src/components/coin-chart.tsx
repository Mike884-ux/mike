import { useEffect, useRef } from "react";
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

const UP = "#2fd08a";
const DOWN = "#ff6b6b";

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
  className,
}: {
  candles: Candle[];
  levels?: AiLevels | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const t = useT();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: { background: { color: "transparent" }, textColor: "#8f98b3", attributionLogo: false },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)", scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: "rgba(255,255,255,0.08)" },
      width: container.clientWidth,
      height: container.clientHeight || 420,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: UP,
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;

    const resize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight || 420 });
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
    };
  }, []);

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
        color: row.close >= row.open ? "rgba(47,208,138,0.45)" : "rgba(255,107,107,0.45)",
      })),
    );
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

  return <div ref={containerRef} className={cn("h-[420px] w-full overflow-hidden rounded-lg bg-surface-2", className)} />;
}
