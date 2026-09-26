import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { pctAbs } from "@/lib/format";

/** Coin logo with a lettered fallback when the image is missing or fails. */
export const CoinLogo = memo(function CoinLogo({
  src,
  symbol,
  className,
}: {
  src: string | null | undefined;
  symbol: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 font-mono text-[9px] font-bold text-muted uppercase",
          className,
        )}
      >
        {symbol.slice(0, 3)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      width={24}
      height={24}
      onError={() => setFailed(true)}
      className={cn("size-6 shrink-0 rounded-full bg-surface-2 object-contain", className)}
    />
  );
});

function Caret({ up, className }: { up: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden className={cn("size-2.5 shrink-0", className)}>
      <path d={up ? "M5 1.5 9 8H1z" : "M5 8.5 1 2h8z"} fill="currentColor" />
    </svg>
  );
}

/** "▲ 1.23%" in green or "▼ 0.40%" in red; a dash when unknown. */
export function Change({ value, className, digits = 2 }: { value: number | null | undefined; className?: string; digits?: number }) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return <span className={cn("text-faint", className)}>—</span>;
  }
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center justify-end gap-1 font-medium tabular-nums", up ? "text-long" : "text-short", className)}>
      <Caret up={up} />
      {pctAbs(value, digits)}
    </span>
  );
}

/** Same as Change, on a tinted pill (coin page header, highlight cards). */
export function ChangePill({ value, className, suffix }: { value: number | null | undefined; className?: string; suffix?: string }) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold tabular-nums",
        up ? "bg-long/12 text-long" : "bg-short/12 text-short",
        className,
      )}
    >
      <Caret up={up} />
      {pctAbs(value)}
      {suffix ? <span className="font-normal opacity-80">{suffix}</span> : null}
    </span>
  );
}

/** 7-day price line, green when the week closed higher. */
export const Sparkline = memo(function Sparkline({
  values,
  className,
  up,
  fill = false,
}: {
  values: number[];
  className?: string;
  /** Force a colour; by default it follows first vs last value. */
  up?: boolean;
  fill?: boolean;
}) {
  if (values.length < 2) return <span className={cn("block", className)} aria-hidden />;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const w = 164;
  const h = 48;
  const pad = 2;
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    pad + (h - pad * 2) * (1 - (v - min) / span),
  ]);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x!.toFixed(1)} ${y!.toFixed(1)}`).join("");
  const rising = up ?? values.at(-1)! >= values[0]!;
  const color = rising ? "var(--color-long)" : "var(--color-short)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("block h-12 w-40", className)} aria-hidden>
      {fill ? <path d={`${line}L${w} ${h}L0 ${h}Z`} fill={color} opacity="0.1" /> : null}
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
});

/** Thin progress bar (circulating vs max supply, 24h low–high). */
export function Meter({ percent, className }: { percent: number | null; className?: string }) {
  if (percent === null) return null;
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)} aria-hidden>
      <span className="block h-full rounded-full bg-faint/70" style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
    </span>
  );
}
