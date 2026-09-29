import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Scale } from "lucide-react";
import { EXCHANGE_INFO } from "@/lib/exchanges";
import { useT } from "@/lib/i18n";
import { COUNTRIES } from "@/lib/lang";
import { useSettings } from "@/lib/settings-store";
import { useExchangeRanking, useTradePicker } from "@/lib/use-exchanges";
import { cn } from "@/lib/utils";
import { CountrySelect, ExchangeCard, ExchangeLogo } from "@/components/exchange-picker";

/**
 * "Where to buy BTC" on a coin page: the recommended exchange and an
 * alternative for the visitor's country, then the rest with the pairs each one
 * lists — the full list and comparison one tap away.
 */
export function WhereToBuy({ symbol, name }: { symbol: string; name: string }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const { ranking, loading, country, refs } = useExchangeRanking(symbol);
  const openFor = useTradePicker((s) => s.openFor);
  const countryName = COUNTRIES.find((c) => c.id === country)?.[lang] ?? country;

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">{t("trade.where", { symbol })}</h2>
        <CountrySelect className="h-8" />
      </div>
      <p className="mt-1 text-[11px] text-faint">{t("ex.whereHint", { country: countryName })}</p>

      <div className="mt-3 flex flex-col gap-3">
        {loading ? (
          <div className="skeleton h-52 rounded-2xl" />
        ) : ranking.recommended ? (
          <>
            <ExchangeCard r={ranking.recommended} symbol={symbol} kind="recommended" refs={refs} country={country} />
            {ranking.alternative ? <ExchangeCard r={ranking.alternative} symbol={symbol} kind="alternative" refs={refs} country={country} /> : null}
          </>
        ) : (
          <p className="rounded-xl bg-wait/10 p-3 text-xs text-wait">{t("ex.none", { symbol })}</p>
        )}
      </div>

      {ranking.rest.length ? (
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {ranking.rest.map((r) => {
            const off = r.availability === "blocked" || (r.quotes !== null && !r.quotes.length);
            return (
              <li key={r.id} className={cn("flex items-center gap-2.5 py-2", off && "opacity-55")}>
                <ExchangeLogo id={r.id} className="size-7 rounded-lg text-[9px]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-fg">{EXCHANGE_INFO[r.id].name}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {r.availability === "blocked"
                      ? t("ex.blocked")
                      : r.quotes === null
                        ? t("ex.unchecked", { symbol })
                        : r.quotes.length
                          ? r.quotes.slice(0, 3).map((q) => `${symbol}/${q}`).join(" · ")
                          : t("ex.noPair", { symbol })}
                  </span>
                </span>
                {off ? null : (
                  <button type="button" onClick={() => openFor(symbol, name)} aria-label={t("ex.open")} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
                    <ArrowUpRight className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => openFor(symbol, name)} className="text-xs font-semibold text-primary hover:underline">
          {t("ex.more")}
        </button>
        <Link to="/exchanges" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
          <Scale className="size-3.5" />
          {t("ex.compare")}
        </Link>
      </div>
    </section>
  );
}
