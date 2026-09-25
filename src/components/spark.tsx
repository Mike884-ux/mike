import type { Candle } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Spark({
  candles,
  className,
}: {
  candles: Candle[];
  className?: string;
}) {
  if (candles.length < 2) return null;
  const values = candles.map((c) => c.c);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 160;
  const h = 40;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values.at(-1)! >= values[0]!;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-10 w-40 overflow-visible", className)}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={up ? "var(--color-long)" : "var(--color-short)"}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
