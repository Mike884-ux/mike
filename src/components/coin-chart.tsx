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

const LEVEL_META: {
  key: "resistance" | "target" | "entry" | "support" | "stopLoss";
  label: string;
  color: string;
}[] = [
  { key: "resistance", label: "Сопротивление", color: "#c86a64" },
  { key: "target", label: "Цель", color: "#6ea37a" },
  { key: "entry", label: "Вход", color: "#f3f1ec" },
  { key: "support", label: "Поддержка", color: "#6ea37a" },
  { key: "stopLoss", label: "Стоп", color: "#c86a64" },
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: { background: { color: "transparent" }, textColor: "#9a9892", attributionLogo: false },
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
      upColor: "#6ea37a",
      downColor: "#c86a64",
      borderVisible: false,
      wickUpColor: "#6ea37a",
      wickDownColor: "#c86a64",
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "#6ea37a",
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
        color: row.close >= row.open ? "rgba(110,163,122,0.5)" : "rgba(200,106,100,0.5)",
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
          title: meta.label,
        }),
      );
    }
  }, [levels]);

  return <div ref={containerRef} className={cn("h-[420px] w-full overflow-hidden rounded-lg bg-surface-2", className)} />;
}
