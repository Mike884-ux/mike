/** Resolved theme colours for canvas charts, which can't read CSS variables themselves. */
export type ChartPalette = { text: string; grid: string; border: string; up: string; down: string; primary: string; surface: string };

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function chartPalette(): ChartPalette {
  return {
    text: cssVar("--color-faint", "#8b93a7"),
    grid: cssVar("--color-border", "#e7ebf1"),
    border: cssVar("--color-border", "#e7ebf1"),
    up: cssVar("--color-long", "#0b9b5d"),
    down: cssVar("--color-short", "#e03a3e"),
    primary: cssVar("--color-primary", "#5b5bd6"),
    surface: cssVar("--color-surface", "#ffffff"),
  };
}

/** "#0b9b5d" + 0.4 → "rgba(11,155,93,0.4)"; anything else is returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
