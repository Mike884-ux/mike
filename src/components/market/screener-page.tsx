import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Bell, Bookmark, Crown, Filter, Lock, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { addScreen, getScreens, removeScreen } from "@/lib/alerts";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { MarketCoin } from "@/lib/coins";
import { usdCompact, usdPrice } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { scanMarket } from "@/lib/scan";
import {
  applyScreen,
  needsTech,
  PRESET_IDS,
  PRESETS,
  usesProFilters,
  type PresetId,
  type Range,
  type ScreenFilters,
  type ScreenRow,
  type ScreenTech,
  type SortKey,
} from "@/lib/screener";
import { useBilling } from "@/lib/use-billing";
import { useListing } from "@/lib/use-market";
import { cn } from "@/lib/utils";
import { Change, CoinLogo } from "@/components/market/bits";
import { Container } from "@/components/site/shell";
import { AiCell } from "@/components/ai-cell";
import { getAiVerdicts, type AiVerdict } from "@/lib/coin-detail";
import { assetOf } from "@/lib/markets";
import { useSettings } from "@/lib/settings-store";
import { TradeButton } from "@/components/trade-buttons";

const FREE_ROWS = 100;
const MILLION = 1_000_000;

/** Numbers typed by people: "1,5" and "" are fine; anything else is no bound. */
function parse(value: string): number | null {
  const n = Number(value.replace(",", ".").trim());
  return value.trim() === "" || !Number.isFinite(n) ? null : n;
}

function show(value: number | null | undefined, scale = 1): string {
  return value === null || value === undefined ? "" : String(value / scale);
}

function useScreenerData(pro: boolean, signedIn: boolean) {
  const p1 = useListing(1);
  const p2 = useListing(2, undefined, pro);
  const p3 = useListing(3, undefined, pro);
  const scan = useQuery({
    queryKey: ["scan", "1h"],
    queryFn: () => scanMarket({ data: { interval: "1h" } }),
    enabled: signedIn,
    staleTime: 25_000,
    refetchInterval: 60_000,
  });
  const rows = useMemo(() => {
    const tech = new Map<string, ScreenTech>();
    for (const row of scan.data ?? []) {
      if (row.kind !== "crypto") continue;
      tech.set(row.base, { signal: row.signal, score: row.score, confidence: row.confidence, rsi: row.rsi, volumeRatio: row.volumeRatio });
    }
    const pages: MarketCoin[][] = [p1.data?.coins ?? [], ...(pro ? [p2.data?.coins ?? [], p3.data?.coins ?? []] : [])];
    const seen = new Set<string>();
    const out: ScreenRow[] = [];
    for (const coin of pages.flat()) {
      if (seen.has(coin.id)) continue;
      seen.add(coin.id);
      out.push({ ...coin, tech: tech.get(coin.symbol.toUpperCase()) ?? null });
    }
    return out;
  }, [p1.data, p2.data, p3.data, scan.data, pro]);
  return {
    rows,
    loading: p1.isLoading,
    failed: p1.isError && !p1.data,
    techCount: scan.data?.filter((r) => r.kind === "crypto").length ?? 0,
    techLoading: signedIn && scan.isLoading,
    source: p1.data?.source,
    updatedAt: p1.data?.updatedAt,
  };
}

function RangeInputs({
  label,
  range,
  onChange,
  scale = 1,
  suffix,
  locked,
}: {
  label: string;
  range: Range | undefined;
  onChange: (range: Range) => void;
  scale?: number;
  suffix: string;
  locked?: boolean;
}) {
  const t = useT();
  const input = "h-10 w-full min-w-0 rounded-lg bg-surface-2 px-3 text-sm text-fg tabular-nums outline-none ring-1 ring-border focus:ring-primary disabled:opacity-50";
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
        {label}
        {locked ? <Lock className="size-3 text-wait" /> : null}
      </legend>
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          disabled={locked}
          aria-label={`${label} ${t("scr.from")}`}
          placeholder={t("scr.from")}
          value={show(range?.min, scale)}
          onChange={(e) => {
            const v = parse(e.target.value);
            onChange({ ...range, min: v === null ? null : v * scale });
          }}
          className={input}
        />
        <span className="text-faint">—</span>
        <input
          inputMode="decimal"
          disabled={locked}
          aria-label={`${label} ${t("scr.to")}`}
          placeholder={t("scr.to")}
          value={show(range?.max, scale)}
          onChange={(e) => {
            const v = parse(e.target.value);
            onChange({ ...range, max: v === null ? null : v * scale });
          }}
          className={input}
        />
        <span className="shrink-0 text-xs text-faint">{suffix}</span>
      </div>
    </fieldset>
  );
}

function SortHeader({ label, k, sort, dir, onSort, className }: { label: string; k: SortKey; sort: SortKey; dir: "asc" | "desc"; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort === k;
  return (
    <th scope="col" className={cn("px-3 py-3 text-right text-xs font-semibold whitespace-nowrap text-fg", className)} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex flex-row-reverse items-center gap-1 outline-none hover:text-primary focus-visible:text-primary">
        {active ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
        {label}
      </button>
    </th>
  );
}

export function ScreenerPage({ preset: initialPreset }: { preset?: PresetId }) {
  const t = useT();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCurrentUserState();
  const billing = useBilling().data;
  const signedIn = Boolean(user);
  const pro = Boolean(billing && (billing.plan !== "free" || billing.isAdmin));

  const [preset, setPreset] = useState<PresetId | null>(initialPreset ?? null);
  const [filters, setFilters] = useState<ScreenFilters>(initialPreset ? PRESETS[initialPreset].filters : {});
  const [sort, setSort] = useState<SortKey>(initialPreset ? PRESETS[initialPreset].sort : "rank");
  const [dir, setDir] = useState<"asc" | "desc">(initialPreset ? PRESETS[initialPreset].dir : "asc");
  const [open, setOpen] = useState(false);

  const data = useScreenerData(pro, signedIn);
  // Free members may run every preset; only hand-set Pro filters are locked.
  const locked = !pro && preset === null && usesProFilters(filters);
  const result = useMemo(() => (locked ? [] : applyScreen(data.rows, filters, sort, dir)), [data.rows, filters, sort, dir, locked]);
  const tech = needsTech(filters) || sort === "score" || sort === "rsi";

  // The AI's calls already made in the last 15 minutes (shared cache: free, no AI request).
  const lang = useSettings((s) => s.lang);
  const client = useQueryClient();
  const aiBases = useMemo(
    () => [...new Set(result.slice(0, 300).map((row) => row.symbol.toUpperCase()).filter((b) => assetOf(b)))].slice(0, 120).sort(),
    [result],
  );
  const verdictsKey = useMemo(() => ["ai-verdicts", "1h", lang, aiBases.join(",")], [lang, aiBases]);
  const verdicts = useQuery({
    queryKey: verdictsKey,
    queryFn: () => getAiVerdicts({ data: { bases: aiBases, interval: "1h", lang } }),
    enabled: signedIn && aiBases.length > 0,
    staleTime: 50_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const onAnswer = (base: string, verdict: AiVerdict) =>
    client.setQueryData<Record<string, AiVerdict>>(verdictsKey, (prev) => ({ ...prev, [base]: verdict }));

  const choose = (id: PresetId) => {
    if (preset === id) return reset();
    setPreset(id);
    setFilters(PRESETS[id].filters);
    setSort(PRESETS[id].sort);
    setDir(PRESETS[id].dir);
    void navigate({ to: "/screener", search: { preset: id }, replace: true });
  };
  const reset = () => {
    setPreset(null);
    setFilters({});
    setSort("rank");
    setDir("asc");
    void navigate({ to: "/screener", search: {}, replace: true });
  };
  const edit = (next: ScreenFilters) => {
    setPreset(null);
    setFilters(next);
  };
  const onSort = (k: SortKey) => {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(k);
      setDir(k === "rank" || k === "rsi" ? "asc" : "desc");
    }
  };

  let body: ReactNode;
  if (data.loading) body = <div className="skeleton h-96 w-full rounded-2xl" />;
  else if (data.failed) body = <Empty text={t("scr.failed")} />;
  else if (locked) body = <ProLock />;
  else if (tech && !signedIn)
    body = (
      <div className="rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-border)]">
        <p className="text-sm text-muted">{t("scr.techGuest")}</p>
        <Link to="/login" search={{ mode: "signup", redirect: pathname }} className="bg-brand mt-4 inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-white">
          {t("gate.cta")}
        </Link>
      </div>
    );
  else if (tech && data.techLoading) body = <div className="skeleton h-96 w-full rounded-2xl" />;
  else if (!result.length) body = <Empty text={t("scr.empty")} onReset={reset} />;
  else
    body = (
      <div className="overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[21rem] border-collapse">
          <thead className="border-b border-border">
            <tr>
              <SortHeader label="#" k="rank" sort={sort} dir={dir} onSort={onSort} className="hidden w-12 text-left lg:table-cell" />
              <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-fg">{t("table.name")}</th>
              <th scope="col" className="w-7 xl:hidden" aria-label={t("ex.button")} />
              <th scope="col" className="px-3 py-3 text-right text-xs font-semibold text-fg">{t("table.price")}</th>
              <SortHeader label={t("table.24h")} k="change24h" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label={t("table.7d")} k="change7d" sort={sort} dir={dir} onSort={onSort} className="hidden md:table-cell" />
              <SortHeader label={t("table.marketCap")} k="marketCap" sort={sort} dir={dir} onSort={onSort} className="hidden md:table-cell" />
              <SortHeader label={t("table.volume")} k="volume24h" sort={sort} dir={dir} onSort={onSort} className="hidden lg:table-cell" />
              <SortHeader label="RSI" k="rsi" sort={sort} dir={dir} onSort={onSort} className="hidden sm:table-cell" />
              <th scope="col" className="hidden px-3 py-3 text-right text-xs font-semibold text-fg sm:table-cell">{t("scan.col.ai")}</th>
              <th scope="col" className="hidden px-3 py-3 xl:table-cell" />
            </tr>
          </thead>
          <tbody>
            {result.slice(0, 300).map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                <td className="hidden px-3 py-3 text-left text-xs text-muted tabular-nums lg:table-cell">{row.rank ?? "—"}</td>
                <td className="px-3 py-3">
                  <Link to="/coins/$id" params={{ id: row.id }} className="flex min-w-0 items-center gap-2.5 outline-none focus-visible:underline">
                    <CoinLogo src={row.image} symbol={row.symbol} />
                    <span className="flex min-w-0 flex-col">
                      <span className="max-w-[5rem] truncate text-sm font-semibold text-fg sm:max-w-[12rem]">{row.name}</span>
                      <span className="text-xs text-faint">{row.symbol}</span>
                    </span>
                  </Link>
                </td>
                <td className="py-3 pr-0 pl-0.5 xl:hidden">
                  <TradeButton symbol={row.symbol} name={row.name} variant="icon" />
                </td>
                <td className="px-3 py-3 text-right text-sm font-semibold text-fg tabular-nums">{usdPrice(row.price)}</td>
                <td className="px-3 py-3 text-right text-sm"><Change value={row.change24h} /></td>
                <td className="hidden px-3 py-3 text-right text-sm md:table-cell"><Change value={row.change7d} /></td>
                <td className="hidden px-3 py-3 text-right text-sm text-fg tabular-nums md:table-cell">{usdCompact(row.marketCap)}</td>
                <td className="hidden px-3 py-3 text-right text-sm text-fg tabular-nums lg:table-cell">{usdCompact(row.volume24h)}</td>
                <td className={cn("hidden px-3 py-3 text-right text-sm tabular-nums sm:table-cell", row.tech && row.tech.rsi < 30 ? "text-long" : row.tech && row.tech.rsi > 70 ? "text-short" : "text-fg")}>
                  {row.tech ? Math.round(row.tech.rsi) : <span className="text-faint">—</span>}
                </td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">
                  {signedIn && assetOf(row.symbol.toUpperCase()) ? (
                    <AiCell base={row.symbol.toUpperCase()} interval="1h" verdict={verdicts.data?.[row.symbol.toUpperCase()]} onAnswer={onAnswer} />
                  ) : (
                    <span className="text-xs text-faint">—</span>
                  )}
                </td>
                <td className="hidden py-2 pr-3 pl-2 text-right xl:table-cell">
                  <TradeButton symbol={row.symbol} name={row.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <Container className="py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-fg sm:text-[28px]">{t("scr.title")}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">{t("scr.subtitle")}</p>
        </div>
        <Link to="/alerts" className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-semibold text-fg shadow-[var(--shadow-border)] hover:bg-surface-2">
          <Bell className="size-4 text-primary" />
          {t("scr.alerts")}
        </Link>
      </div>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {PRESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => choose(id)}
            aria-pressed={preset === id}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap ring-1 transition",
              preset === id ? "bg-primary text-primary-fg ring-primary" : "bg-surface text-fg ring-border hover:bg-surface-2",
            )}
          >
            {t(`scr.p.${id}` as MessageKey)}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold text-fg">
            <SlidersHorizontal className="size-4 text-primary" />
            {t("scr.custom")}
          </span>
          <span className="text-xs text-muted">{t(open ? "scr.hide" : "scr.show")}</span>
        </button>
        {open ? (
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2 xl:grid-cols-4">
            <RangeInputs label={t("scr.f.change24h")} suffix="%" range={filters.change24h} onChange={(r) => edit({ ...filters, change24h: r })} />
            <RangeInputs label={t("scr.f.marketCap")} suffix={t("scr.mln")} scale={MILLION} range={filters.marketCap} onChange={(r) => edit({ ...filters, marketCap: r })} />
            <RangeInputs label={t("scr.f.change1h")} suffix="%" locked={!pro} range={filters.change1h} onChange={(r) => edit({ ...filters, change1h: r })} />
            <RangeInputs label={t("scr.f.change7d")} suffix="%" locked={!pro} range={filters.change7d} onChange={(r) => edit({ ...filters, change7d: r })} />
            <RangeInputs label="RSI" suffix="" locked={!pro} range={filters.rsi} onChange={(r) => edit({ ...filters, rsi: r })} />
            <fieldset className="min-w-0">
              <legend className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                {t("scr.f.volumeMin")}
                {!pro ? <Lock className="size-3 text-wait" /> : null}
              </legend>
              <div className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  disabled={!pro}
                  aria-label={t("scr.f.volumeMin")}
                  placeholder="0"
                  value={show(filters.volumeMin, MILLION)}
                  onChange={(e) => {
                    const v = parse(e.target.value);
                    edit({ ...filters, volumeMin: v === null ? null : v * MILLION });
                  }}
                  className="h-10 w-full min-w-0 rounded-lg bg-surface-2 px-3 text-sm text-fg tabular-nums ring-1 ring-border outline-none focus:ring-primary disabled:opacity-50"
                />
                <span className="shrink-0 text-xs text-faint">{t("scr.mln")}</span>
              </div>
            </fieldset>
            <label className={cn("flex items-center gap-2.5 self-end pb-2 text-sm font-medium text-fg", !pro && "opacity-50")}>
              <input type="checkbox" disabled={!pro} checked={filters.highVolume === true} onChange={(e) => edit({ ...filters, highVolume: e.target.checked })} className="size-4 accent-[var(--color-primary)]" />
              {t("scr.f.highVolume")}
              {!pro ? <Lock className="size-3 text-wait" /> : null}
            </label>
            {!pro ? (
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted sm:col-span-2 xl:col-span-4">
                <Crown className="size-3.5 text-wait" />
                {t("scr.proHint")}
                <Link to="/pricing" className="font-semibold text-primary hover:underline">{t("scr.proCta")}</Link>
              </p>
            ) : null}
          </div>
        ) : null}
        {open && pro ? <SavedScreens filters={filters} canSave={Object.keys(filters).length > 0} onApply={(f) => edit(f)} /> : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="flex items-center gap-2 font-semibold text-fg">
          <Filter className="size-4 text-primary" />
          {t("scr.found", { n: result.length, total: data.rows.length })}
        </p>
        {preset || Object.keys(filters).length ? (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-fg">
            <RotateCcw className="size-3.5" />
            {t("scr.reset")}
          </button>
        ) : null}
      </div>
      {tech && signedIn && data.techCount ? <p className="mt-1 text-xs text-faint">{t("scr.techNote", { n: data.techCount })}</p> : null}
      {!pro ? <p className="mt-1 text-xs text-faint">{t("scr.freeRows", { n: FREE_ROWS })}</p> : null}

      <div className="mt-3">{body}</div>
      <p className="mt-4 text-xs text-faint">{t("scr.disclaimer")}</p>
    </Container>
  );
}

function SavedScreens({ filters, onApply, canSave }: { filters: ScreenFilters; onApply: (f: ScreenFilters) => void; canSave: boolean }) {
  const t = useT();
  const client = useQueryClient();
  const list = useQuery({ queryKey: ["screens"], queryFn: () => getScreens(), staleTime: 60_000 });
  const [name, setName] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const save = useMutation({
    mutationFn: () => addScreen({ data: { name, filters } }),
    onSuccess: (res) => {
      if (!res.ok) return setError(res.error === "limit" ? "scr.saveLimit" : res.error === "pro" ? "scr.lockTitle" : "scr.saveName");
      setName("");
      setError(null);
      void client.invalidateQueries({ queryKey: ["screens"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeScreen({ data: { id } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["screens"] }),
  });
  return (
    <div className="border-t border-border p-4">
      <p className="flex items-center gap-2 text-xs font-semibold text-muted">
        <Bookmark className="size-3.5 text-primary" />
        {t("scr.saved")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(list.data ?? []).map((screen) => (
          <span key={screen.id} className="flex h-9 items-center rounded-full bg-surface-2 ring-1 ring-border">
            <button type="button" onClick={() => onApply(screen.filters)} className="pl-3.5 pr-1.5 text-sm font-semibold text-fg">{screen.name}</button>
            <button type="button" onClick={() => remove.mutate(screen.id)} aria-label={t("scr.deleteSaved")} className="grid size-7 place-items-center rounded-full text-faint hover:text-short">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {!list.data?.length ? <span className="text-xs text-faint">{t("scr.savedEmpty")}</span> : null}
      </div>
      {canSave ? (
        <form
          className="mt-3 flex max-w-md gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return setError("scr.saveName");
            save.mutate();
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("scr.namePlaceholder")} className="h-10 min-w-0 flex-1 rounded-lg bg-surface-2 px-3 text-sm text-fg ring-1 ring-border outline-none focus:ring-primary" />
          <button type="submit" disabled={save.isPending} className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60">{t("scr.save")}</button>
        </form>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-xs text-short">{t(error)}</p> : null}
    </div>
  );
}

function Empty({ text, onReset }: { text: string; onReset?: () => void }) {
  const t = useT();
  return (
    <div className="rounded-2xl bg-surface p-8 text-center text-sm text-muted shadow-[var(--shadow-border)]">
      {text}
      {onReset ? (
        <div>
          <button type="button" onClick={onReset} className="mt-3 text-sm font-semibold text-primary hover:underline">{t("scr.reset")}</button>
        </div>
      ) : null}
    </div>
  );
}

function ProLock() {
  const t = useT();
  return (
    <div className="rounded-2xl bg-primary/8 p-6 text-center ring-1 ring-primary/25">
      <Crown className="mx-auto size-6 text-primary" />
      <p className="mt-2 text-sm font-semibold text-fg">{t("scr.lockTitle")}</p>
      <p className="mt-1 text-sm text-muted">{t("scr.proHint")}</p>
      <Link to="/pricing" className="bg-brand mt-4 inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-white">{t("scr.proCta")}</Link>
    </div>
  );
}
