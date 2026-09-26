import { useEffect, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { HistoryPoint, RangeId } from "@/lib/coins";
import { LOCALE } from "@/lib/i18n";
import { useSettings } from "@/lib/settings-store";
import { chartPalette, withAlpha } from "@/lib/theme-colors";
import { cn } from "@/lib/utils";

/** Enough decimals to show movement: 2 for $64,000, 6 for $0.0123, 10 for $0.0000012. */
function precisionFor(price: number): number {
  if (!(price > 0)) return 2;
  if (price >= 1) return 2;
  return Math.min(12, Math.max(4, Math.ceil(-Math.log10(price)) + 3));
}

type Mode = "line" | "candles";

/**
 * Price history chart for the coin page: a filled line (or real candles when
 * the data has them) with volume bars underneath. Colours follow the theme and
 * whether the period closed higher.
 */
export function PriceChart({ points, mode, range, className }: { points: HistoryPoint[]; mode: Mode; range: RangeId; className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const theme = useSettings((s) => s.theme);
  const lang = useSettings((s) => s.lang);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || points.length < 2) return;
    const p = chartPalette();
    const axisDigits = precisionFor(points.at(-1)?.c ?? 0);
    const chart = createChart(container, {
      localization: {
        locale: LOCALE[lang],
        priceFormatter: (value: number) =>
          value.toLocaleString("en-US", { minimumFractionDigits: Math.abs(value) >= 1000 ? 0 : Math.min(axisDigits, 2), maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : axisDigits }),
      },
      layout: { background: { color: "transparent" }, textColor: p.text, attributionLogo: false, fontFamily: "Inter Variable, Inter, system-ui, sans-serif" },
      grid: { vertLines: { visible: false }, horzLines: { color: withAlpha(p.grid, 0.7) } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: p.border, timeVisible: range === "1d" || range === "7d", secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { mode: CrosshairMode.Magnet },
      handleScroll: { vertTouchDrag: false },
      width: container.clientWidth,
      height: container.clientHeight || 400,
    });
    chartRef.current = chart;

    const seen = new Set<number>();
    const rows = points
      .map((pt) => ({ ...pt, time: Math.floor(pt.t / 1000) as UTCTimestamp }))
      .filter((pt) => (seen.has(pt.time) ? false : (seen.add(pt.time), true)));
    const last = rows.at(-1)!.c;
    const rising = last >= rows[0]!.c;
    const color = rising ? p.up : p.down;
    const precision = precisionFor(last);
    const priceFormat = { type: "price" as const, precision, minMove: 1 / 10 ** precision };

    if (mode === "candles") {
      const candles = chart.addSeries(CandlestickSeries, {
        upColor: p.up,
        downColor: p.down,
        borderVisible: false,
        wickUpColor: p.up,
        wickDownColor: p.down,
        priceFormat,
      });
      candles.setData(rows.map((r) => ({ time: r.time, open: r.o, high: r.h, low: r.l, close: r.c })));
    } else {
      const area = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: withAlpha(color, 0.28),
        bottomColor: withAlpha(color, 0.02),
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: withAlpha(color, 0.6),
        priceFormat,
      });
      area.setData(rows.map((r) => ({ time: r.time, value: r.c })));
    }

    if (rows.some((r) => r.v > 0)) {
      const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", lastValueVisible: false, priceLineVisible: false });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
      volume.setData(
        rows.map((r, i) => ({
          time: r.time,
          value: r.v,
          color: withAlpha((mode === "candles" ? r.c >= r.o : i === 0 || r.c >= rows[i - 1]!.c) ? p.up : p.down, 0.35),
        })),
      );
    }
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight || 400 });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [points, mode, range, theme, lang]);

  return <div ref={containerRef} className={cn("h-[400px] w-full", className)} />;
}
