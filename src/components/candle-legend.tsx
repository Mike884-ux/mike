import { useEffect, useMemo, useState } from "react";
import type { IChartApi, MouseEventParams, Time } from "lightweight-charts";
import { useT } from "@/lib/i18n";
import { cn, formatPrice } from "@/lib/utils";

export type LegendCandle = { time: number; o: number; h: number; l: number; c: number; v: number };

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

/**
 * The exchange-style readout over a candle chart: open, high, low, close,
 * change and volume of the candle under the cursor — or the last one.
 */
export function CandleLegend({ chart, rows, className }: { chart: IChartApi | null; rows: LegendCandle[]; className?: string }) {
  const t = useT();
  const byTime = useMemo(() => new Map(rows.map((r) => [r.time, r])), [rows]);
  const [hovered, setHovered] = useState<LegendCandle | null>(null);

  useEffect(() => {
    if (!chart) return;
    const onMove = (param: MouseEventParams<Time>) => {
      setHovered(typeof param.time === "number" ? (byTime.get(param.time) ?? null) : null);
    };
    chart.subscribeCrosshairMove(onMove);
    return () => chart.unsubscribeCrosshairMove(onMove);
  }, [chart, byTime]);

  const candle = hovered ?? rows.at(-1);
  if (!candle) return null;
  const up = candle.c >= candle.o;
  const change = candle.o > 0 ? ((candle.c - candle.o) / candle.o) * 100 : 0;
  const tone = up ? "text-[#0ecb81]" : "text-[#f6465d]";
  const item = (label: string, value: string) => (
    <span className="whitespace-nowrap">
      <span className="text-faint">{label}</span> <span className="text-fg">{value}</span>
    </span>
  );
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-2 left-2 z-10 flex max-w-[calc(100%-5rem)] flex-wrap gap-x-2.5 gap-y-0.5 font-mono text-[10px] tabular-nums sm:text-[11px]",
        className,
      )}
      aria-hidden
    >
      {item(t("chart.open"), formatPrice(candle.o))}
      {item(t("chart.high"), formatPrice(candle.h))}
      {item(t("chart.low"), formatPrice(candle.l))}
      {item(t("chart.close"), formatPrice(candle.c))}
      <span className={cn("whitespace-nowrap", tone)}>
        {change >= 0 ? "+" : ""}
        {change.toFixed(2)}%
      </span>
      {candle.v > 0 ? item(t("chart.volume"), compact.format(candle.v)) : null}
    </div>
  );
}
