import type { ReactNode } from "react";
import { useT, type MessageKey } from "@/lib/i18n";
import { numFull, usdCompact } from "@/lib/format";
import { useGlobalStats } from "@/lib/use-market";
import { Change } from "@/components/market/bits";
import { LanguageMenu, ThemeToggle } from "@/components/site/prefs";

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span className="text-faint">{label}:</span>
      <span className="font-semibold text-fg tabular-nums">{children}</span>
    </span>
  );
}

export function fngTone(value: number): string {
  if (value <= 25) return "text-short";
  if (value <= 45) return "text-wait";
  if (value <= 55) return "text-muted";
  return "text-long";
}

/** The thin market summary line above the header on every page. */
export function StatsBar() {
  const t = useT();
  const stats = useGlobalStats();
  const s = stats.data;
  return (
    <div className="border-b border-border bg-surface text-xs">
      <div className="mx-auto flex h-9 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-5 overflow-x-auto">
          {s ? (
            <>
              {s.coins !== null ? <Item label={t("stats.coins")}>{numFull(s.coins)}</Item> : null}
              {s.markets !== null ? <Item label={t("stats.markets")}>{numFull(s.markets)}</Item> : null}
              {s.marketCap !== null ? (
                <Item label={t("stats.cap")}>
                  <span className="flex items-center gap-1.5">
                    {usdCompact(s.marketCap)}
                    <Change value={s.marketCapChange24h} className="text-[11px]" />
                  </span>
                </Item>
              ) : null}
              {s.volume24h !== null ? <Item label={t("stats.volume")}>{usdCompact(s.volume24h)}</Item> : null}
              {s.btcDominance !== null ? (
                <Item label={t("stats.dominance")}>
                  BTC {s.btcDominance.toFixed(1)}%{s.ethDominance !== null ? ` · ETH ${s.ethDominance.toFixed(1)}%` : ""}
                </Item>
              ) : null}
              {s.fearGreed ? (
                <Item label={t("fng.short")}>
                  <span className={fngTone(s.fearGreed.value)}>
                    {s.fearGreed.value}/100 · {t(`fng.${s.fearGreed.label}` as MessageKey)}
                  </span>
                </Item>
              ) : null}
            </>
          ) : stats.isLoading ? (
            <span className="skeleton h-3 w-96 max-w-full" />
          ) : (
            <span className="text-faint">{t("stats.unavailable")}</span>
          )}
        </div>
        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
