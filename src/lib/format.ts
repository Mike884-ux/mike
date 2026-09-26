/**
 * Number formatting for the market pages. One style everywhere (en-US
 * grouping, $ in front) so the table, cards and coin page read the same.
 */

const DASH = "—";

function ok(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** $64,012.35 · $0.5234 · $0.00001234 — sub-dollar prices keep 4 significant digits. */
export function usdPrice(value: number | null | undefined): string {
  if (!ok(value)) return DASH;
  const abs = Math.abs(value);
  let digits = 2;
  if (abs > 0 && abs < 1) digits = abs >= 0.01 ? 4 : Math.min(12, Math.floor(-Math.log10(abs)) + 4);
  const text = abs.toLocaleString("en-US", { minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits });
  return `${value < 0 ? "-" : ""}$${text}`;
}

/** $1,262,004,512,331 */
export function usdFull(value: number | null | undefined): string {
  if (!ok(value)) return DASH;
  return `${value < 0 ? "-" : ""}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

const UNITS: [number, string][] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** 19.72M · 1.26T · 845 */
export function numCompact(value: number | null | undefined, digits = 2): string {
  if (!ok(value)) return DASH;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  for (const [size, unit] of UNITS) {
    if (abs >= size) return `${sign}${(abs / size).toFixed(digits)}${unit}`;
  }
  return `${sign}${abs.toLocaleString("en-US", { maximumFractionDigits: abs >= 10 ? 0 : 2 })}`;
}

/** $2.34T · $85.21B */
export function usdCompact(value: number | null | undefined, digits = 2): string {
  if (!ok(value)) return DASH;
  const text = numCompact(Math.abs(value), digits);
  return `${value < 0 ? "-" : ""}$${text}`;
}

/** 19,715,000 */
export function numFull(value: number | null | undefined): string {
  if (!ok(value)) return DASH;
  return Math.round(value).toLocaleString("en-US");
}

/** 1.23% without a sign — the arrow next to it shows the direction. */
export function pctAbs(value: number | null | undefined, digits = 2): string {
  if (!ok(value)) return DASH;
  return `${groupPct(Math.abs(value), digits)}%`;
}

/** 1.23 → "1.23"; 99900 → "99,900" (huge moves since launch read better grouped and whole). */
function groupPct(abs: number, digits: number): string {
  return abs >= 1000 ? Math.round(abs).toLocaleString("en-US") : abs.toFixed(digits);
}

/** +1.23% / −0.40% */
export function pctSigned(value: number | null | undefined, digits = 2): string {
  if (!ok(value)) return DASH;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${groupPct(Math.abs(value), digits)}%`;
}

/** Share of `part` in `whole`, clamped to 0..100, or null when unknown. */
export function share(part: number | null | undefined, whole: number | null | undefined): number | null {
  if (!ok(part) || !ok(whole) || whole <= 0) return null;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}
