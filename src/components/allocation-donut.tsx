import { useT } from "@/lib/i18n";
import { formatUsd } from "@/lib/utils";

const COLORS = [
  "#6366f1",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#22c55e",
  "#0ea5e9",
  "#f97316",
  "#a855f7",
];
const MAX_SLICES = 7;

export type Slice = { label: string; value: number };

/** Groups the tail into "other" so the ring stays readable. */
export function toSlices(items: Slice[], otherLabel: string): Slice[] {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_SLICES) return sorted;
  const head = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1).reduce((s, i) => s + i.value, 0);
  return [...head, { label: otherLabel, value: rest }];
}

/** Ring chart of what the portfolio is made of, with a legend. */
export function AllocationDonut({ items }: { items: Slice[] }) {
  const t = useT();
  const slices = toSlices(items, t("wallet.other"));
  const total = slices.reduce((s, i) => s + i.value, 0);
  if (!total) return null;
  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 1.2 : 0;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative size-44 shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="size-full -rotate-90"
          role="img"
          aria-label={t("wallet.allocation")}
        >
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth="12"
          />
          {slices.map((slice, i) => {
            const len = (slice.value / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle
                key={slice.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth="12"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              >
                <title>{`${slice.label}: ${((slice.value / total) * 100).toFixed(1)}%`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[10px] text-faint uppercase">{t("wallet.total")}</p>
            <p className="font-display text-base font-bold text-fg tabular-nums">
              {formatUsd(total)}
            </p>
            <p className="text-[10px] text-faint">
              {t("wallet.assetsCount", { n: items.filter((i) => i.value > 0).length })}
            </p>
          </div>
        </div>
      </div>
      <ul className="flex w-full max-w-md flex-1 flex-col gap-2.5">
        {slices.map((slice, i) => (
          <li key={slice.label} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="font-semibold text-fg">{slice.label}</span>
            <span className="ml-auto text-muted tabular-nums">
              {((slice.value / total) * 100).toFixed(1)}%
            </span>
            <span className="w-24 text-right text-xs text-faint tabular-nums">
              {formatUsd(slice.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
