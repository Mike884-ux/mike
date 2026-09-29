import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, ChevronDown, Handshake, Search, ShieldAlert, Star, X } from "lucide-react";
import { EXCHANGE_INFO, tradeUrl, type Exchange, type ExchangeRefs, type RankedExchange } from "@/lib/exchanges";
import { useT, type MessageKey } from "@/lib/i18n";
import { COUNTRIES, type CountryId } from "@/lib/lang";
import { reportExchangeClick } from "@/lib/exchange-clicks";
import { useSettings } from "@/lib/settings-store";
import { useExchangeRanking, useTradePicker } from "@/lib/use-exchanges";
import { cn } from "@/lib/utils";

/** The exchange's name on its brand colours — no third-party logos needed. */
export function ExchangeLogo({ id, className }: { id: Exchange; className?: string }) {
  const info = EXCHANGE_INFO[id];
  return (
    <span
      className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-[11px] font-black tracking-tight shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]", className)}
      style={{ background: info.bg, color: info.fg }}
      aria-hidden
    >
      {info.short}
    </span>
  );
}

function useCountryName(): (id: CountryId) => string {
  const lang = useSettings((s) => s.lang);
  return (id) => {
    const c = COUNTRIES.find((x) => x.id === id);
    return c ? c[lang] : id;
  };
}

/** Why this exchange is suggested, in two or three short reasons. */
function reasons(r: RankedExchange, symbol: string, country: string, t: ReturnType<typeof useT>): string[] {
  const out: string[] = [];
  if (r.favorite) out.push(t("ex.why.favorite"));
  if (r.availability === "ok") out.push(t("ex.why.country", { country }));
  if (r.quotes?.length) out.push(t("ex.why.pair", { pair: `${symbol}/${r.quote}` }));
  const info = EXCHANGE_INFO[r.id];
  if (info.maker + info.taker < 0.2) out.push(t("ex.why.fee"));
  if (r.id === "binance") out.push(t("ex.why.top"));
  return out.slice(0, 3);
}

function pairText(r: RankedExchange, symbol: string, t: ReturnType<typeof useT>): string {
  if (r.quotes === null) return t("ex.unchecked", { symbol });
  if (!r.quotes.length) return t("ex.noPair", { symbol });
  return r.quotes.slice(0, 4).map((q) => `${symbol}/${q}`).join(" · ");
}

function feeText(id: Exchange, t: ReturnType<typeof useT>): string {
  const info = EXCHANGE_INFO[id];
  return t("ex.feeValue", { maker: info.maker, taker: info.taker });
}

function MineButton({ id }: { id: Exchange }) {
  const t = useT();
  const mine = useSettings((s) => s.exchange === id);
  const setExchange = useSettings((s) => s.setExchange);
  return (
    <button
      type="button"
      onClick={() => setExchange(mine ? null : id)}
      aria-pressed={mine}
      title={t(mine ? "ex.unsetMine" : "ex.setMine")}
      aria-label={t(mine ? "ex.unsetMine" : "ex.setMine")}
      className={cn("grid size-8 shrink-0 place-items-center rounded-lg outline-none hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-primary/40", mine ? "text-wait" : "text-faint")}
    >
      <Star className={cn("size-4", mine && "fill-wait")} />
    </button>
  );
}

function GoLink({ r, symbol, refs, big }: { r: RankedExchange; symbol: string; refs: ExchangeRefs | null; big?: boolean }) {
  const t = useT();
  const setExchange = useSettings((s) => s.setExchange);
  const country = useSettings((s) => s.country);
  const info = EXCHANGE_INFO[r.id];
  return (
    <a
      href={tradeUrl(r.id, symbol, refs?.[r.id], r.quote)}
      target="_blank"
      rel="noopener noreferrer sponsored"
      // The exchange someone actually goes to is the one to show first next time.
      onClick={() => {
        setExchange(r.id);
        reportExchangeClick(r.id, country);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-bold whitespace-nowrap outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-primary/50",
        big ? "h-11 w-full px-4 text-sm shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)]" : "h-9 px-3 text-xs",
      )}
      style={{ background: info.bg, color: info.fg }}
    >
      {big ? t("ex.go", { exchange: info.name }) : t("ex.open")}
      <ArrowUpRight className="size-4 opacity-80" />
    </a>
  );
}

function PartnerTag() {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold text-muted" title={t("ex.partnerNote")}>
      <Handshake className="size-3" />
      {t("ex.partner")}
    </span>
  );
}

/** A big "recommended" or "alternative" card. */
export function ExchangeCard({ r, symbol, kind, refs, country }: { r: RankedExchange; symbol: string; kind: "recommended" | "alternative"; refs: ExchangeRefs | null; country: CountryId }) {
  const t = useT();
  const countryName = useCountryName();
  const info = EXCHANGE_INFO[r.id];
  const top = kind === "recommended";
  return (
    <article
      className={cn(
        "ex-card relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4",
        top
          ? "bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-primary)_18%,var(--color-surface-2)),var(--color-surface-2))] shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-primary)_45%,transparent),0_18px_40px_-18px_color-mix(in_oklab,var(--color-primary)_70%,transparent)]"
          : "bg-surface-2 shadow-[0_0_0_1px_var(--color-border),0_14px_30px_-20px_rgba(0,0,0,0.6)]",
      )}
    >
      <div className="flex items-start gap-3">
        <ExchangeLogo id={r.id} className="size-11" />
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase",
              top ? "bg-primary text-primary-fg" : "bg-surface-3 text-muted",
            )}
          >
            {top ? <Star className="size-3 fill-current" /> : null}
            {t(top ? "ex.recommended" : "ex.alternative")}
          </span>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-display text-lg font-bold text-fg">
            {info.name}
            {r.partner ? <PartnerTag /> : null}
          </p>
        </div>
        <MineButton id={r.id} />
      </div>
      <p className="text-xs leading-relaxed text-muted">{reasons(r, symbol, countryName(country), t).join(" · ")}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-surface/70 px-3 py-2">
          <dt className="text-faint">{t("ex.pairs")}</dt>
          <dd className="mt-0.5 truncate font-semibold text-fg">{pairText(r, symbol, t)}</dd>
        </div>
        <div className="rounded-xl bg-surface/70 px-3 py-2">
          <dt className="text-faint">{t("ex.fee")}</dt>
          <dd className="mt-0.5 font-semibold text-fg tabular-nums">{feeText(r.id, t)}</dd>
        </div>
      </dl>
      {r.availability === "limited" ? (
        <p className="flex items-center gap-1.5 text-[11px] text-wait">
          <ShieldAlert className="size-3.5" />
          {t("ex.limited")}
        </p>
      ) : null}
      <GoLink r={r} symbol={symbol} refs={refs} big />
    </article>
  );
}

/** A compact row for the "all exchanges" list. */
export function ExchangeRow({ r, symbol, refs }: { r: RankedExchange; symbol: string; refs: ExchangeRefs | null }) {
  const t = useT();
  const info = EXCHANGE_INFO[r.id];
  const blocked = r.availability === "blocked";
  const missing = r.quotes !== null && r.quotes.length === 0;
  return (
    <li className={cn("ex-card flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5", (blocked || missing) && "opacity-60")}>
      <ExchangeLogo id={r.id} className="size-9 text-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-fg">
          {info.name}
          {r.favorite ? <span className="text-[10px] font-bold text-wait">★ {t("ex.mine")}</span> : null}
          {r.partner && !blocked ? <PartnerTag /> : null}
        </p>
        <p className="truncate text-[11px] text-muted">
          {blocked ? t("ex.blocked") : `${pairText(r, symbol, t)} · ${t("ex.fee").toLowerCase()} ${feeText(r.id, t)}`}
          {r.availability === "limited" ? ` · ${t("ex.limited")}` : ""}
        </p>
      </div>
      {blocked || missing ? null : (
        <>
          <MineButton id={r.id} />
          <GoLink r={r} symbol={symbol} refs={refs} />
        </>
      )}
    </li>
  );
}

export function CountrySelect({ className }: { className?: string }) {
  const t = useT();
  const id = useId();
  const lang = useSettings((s) => s.lang);
  const country = useSettings((s) => s.country);
  const setCountry = useSettings((s) => s.setCountry);
  return (
    <label htmlFor={id} className={cn("relative inline-flex h-9 items-center rounded-xl bg-surface-2 pr-8 pl-3 text-xs font-semibold text-fg ring-1 ring-border", className)}>
      <span className="sr-only">{t("ex.country")}</span>
      <select
        id={id}
        value={country}
        onChange={(e) => setCountry(e.target.value as CountryId)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {COUNTRIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.flag} {c[lang]}
          </option>
        ))}
      </select>
      <span aria-hidden>
        {COUNTRIES.find((c) => c.id === country)?.flag} {COUNTRIES.find((c) => c.id === country)?.[lang]}
      </span>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted" aria-hidden />
    </label>
  );
}

/** The site-wide "where to trade" window; any "Trade" button opens it. */
export function ExchangePicker() {
  const target = useTradePicker((s) => s.target);
  const close = useTradePicker((s) => s.close);
  if (!target) return null;
  return <PickerWindow symbol={target.symbol} name={target.name} onClose={close} />;
}

function PickerWindow({ symbol, name, onClose }: { symbol: string; name?: string; onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const { ranking, loading, country, refs } = useExchangeRanking(symbol);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Capture first: Esc closes this window only, not a coin window underneath.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const needle = query.trim().toLowerCase();
  const everyone = [ranking.recommended, ranking.alternative, ...ranking.rest].filter((r): r is RankedExchange => Boolean(r));
  const found = needle ? everyone.filter((r) => EXCHANGE_INFO[r.id].name.toLowerCase().includes(needle)) : [];
  const partners = everyone.some((r) => r.partner);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm [perspective:1600px] sm:items-center sm:p-4" onClick={onClose} role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="picker-3d relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_0_0_1px_var(--color-border),0_40px_90px_-20px_rgba(0,0,0,0.75)] sm:max-w-[680px] sm:rounded-[28px]"
      >
        <div className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-primary/25 blur-3xl" aria-hidden />
        <header className="relative flex items-start gap-3 px-5 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-xl font-bold text-fg sm:text-2xl">
              {t("ex.title", { symbol })}
            </h2>
            <p className="mt-1 text-sm text-muted">{name ? `${name} · ` : ""}{t("ex.subtitle", { symbol })}</p>
          </div>
          <button type="button" onClick={onClose} autoFocus aria-label={t("common.close")} className="grid size-9 shrink-0 place-items-center rounded-xl text-muted outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40">
            <X className="size-5" />
          </button>
        </header>

        <div className="relative mt-4 flex flex-wrap items-center gap-2 px-5">
          <CountrySelect />
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ex.search")}
              aria-label={t("ex.search")}
              className="h-9 w-full rounded-xl bg-surface-2 pr-3 pl-8 text-xs text-fg ring-1 ring-border outline-none placeholder:text-faint focus-visible:ring-primary"
            />
          </label>
        </div>

        <div className="relative px-5 pt-4 pb-5">
          {needle ? (
            found.length ? (
              <ul className="flex flex-col gap-2">
                {found.map((r) => <ExchangeRow key={r.id} r={r} symbol={symbol} refs={refs} />)}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted">{t("ex.nothingFound")}</p>
            )
          ) : (
            <>
              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="skeleton h-56 rounded-2xl" />
                  <div className="skeleton h-56 rounded-2xl" />
                </div>
              ) : ranking.recommended ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ExchangeCard r={ranking.recommended} symbol={symbol} kind="recommended" refs={refs} country={country} />
                  {ranking.alternative ? <ExchangeCard r={ranking.alternative} symbol={symbol} kind="alternative" refs={refs} country={country} /> : null}
                </div>
              ) : (
                <p className="flex items-start gap-2 rounded-2xl bg-wait/10 p-4 text-sm text-wait">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  {t("ex.none", { symbol })}
                </p>
              )}

              {ranking.rest.length ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    aria-expanded={showAll}
                    className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-semibold text-fg outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {showAll ? t("ex.hide") : t("ex.all", { n: ranking.rest.length })}
                    <ChevronDown className={cn("size-4 transition-transform", showAll && "rotate-180")} />
                  </button>
                  {showAll ? (
                    <ul className="mt-2 flex flex-col gap-2">
                      {ranking.rest.map((r) => <ExchangeRow key={r.id} r={r} symbol={symbol} refs={refs} />)}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 text-[11px] leading-relaxed text-faint">
            {partners ? (
              <p className="flex items-start gap-1.5">
                <Handshake className="mt-0.5 size-3.5 shrink-0" />
                {t("ex.partnerNote")}
              </p>
            ) : null}
            <p className="flex items-start gap-1.5">
              <BadgeCheck className="mt-0.5 size-3.5 shrink-0" />
              {t("ex.availabilityNote")} {t("ex.risk")}
            </p>
            <Link to="/exchanges" onClick={onClose} className="self-start text-xs font-semibold text-primary hover:underline">
              {t("ex.compare")} →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export const DEPOSIT_KEY: Record<string, MessageKey> = {
  p2p: "ex.deposit.p2p",
  card: "ex.deposit.card",
  crypto: "ex.deposit.crypto",
  bank: "ex.deposit.bank",
};
