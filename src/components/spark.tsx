import { memo } from "react";
import { cn } from "@/lib/utils";

/** Tiny line chart of recent closes. */
export const Spark = memo(function Spark({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 160;
  const h = 40;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(" ");
  const up = values.at(-1)! >= values[0]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-10 w-40 overflow-visible", className)} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={up ? "var(--color-long)" : "var(--color-short)"}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
});
