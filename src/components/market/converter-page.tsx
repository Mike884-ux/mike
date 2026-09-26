import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useListing } from "@/lib/use-market";
import { cn } from "@/lib/utils";

type Unit = { id: string; symbol: string; name: string; image: string | null; usd: number };

const USD: Unit = { id: "usd", symbol: "USD", name: "US Dollar", image: null, usd: 1 };
const QUICK = ["BTC", "ETH", "SOL", "TON", "USDT"];

function parse(raw: string): number | null {
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function show(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.0001 ? 8 : 10;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function UnitSelect({ units, value, onChange, label }: { units: Unit[]; value: string; onChange: (id: string) => void; label: string }) {
  const unit = units.find((u) => u.id === value);
  return (
    <label className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-surface-2 pr-2 pl-3 sm:w-56">
      {unit?.image ? <img src={unit.image} alt="" className="size-6 rounded-full" /> : <span className="grid size-6 place-items-center rounded-full bg-long/20 text-xs font-bold text-long">$</span>}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full min-w-0 bg-transparent text-sm font-semibold text-fg outline-none"
      >
        {units.map((u) => (
          <option key={u.id} value={u.id} className="bg-bg">
            {u.symbol} · {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Any of the top-100 coins to any other, or to US dollars, at live prices. */
export function ConverterPage() {
  const t = useT();
  const listing = useListing(1);
  const units = useMemo<Unit[]>(
    () => [USD, ...(listing.data?.coins ?? []).filter((c) => c.price > 0).map((c) => ({ id: c.id, symbol: c.symbol, name: c.name, image: c.image, usd: c.price }))],
    [listing.data],
  );
  const [from, setFrom] = useState("bitcoin");
  const [to, setTo] = useState("usd");
  const [amount, setAmount] = useState("1");
  const a = units.find((u) => u.id === from);
  const b = units.find((u) => u.id === to);
  const n = parse(amount);
  const result = a && b && n !== null ? (n * a.usd) / b.usd : null;

  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">{t("conv.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("conv.subtitle")}</p>

      <div className="mt-5 rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        {listing.isLoading ? (
          <div className="skeleton h-40 w-full" />
        ) : (
          <>
            <p className="text-xs font-medium text-muted">{t("conv.from")}</p>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label={t("conv.amount")}
                className="h-12 w-full min-w-0 flex-1 rounded-xl bg-surface-2 px-3 font-display text-xl font-bold text-fg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <UnitSelect units={units} value={from} onChange={setFrom} label={t("conv.from")} />
            </div>

            <div className="my-3 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
                aria-label={t("conv.swap")}
                className="grid size-10 place-items-center rounded-full bg-primary text-primary-fg shadow-[var(--shadow-glow)] hover:opacity-90"
              >
                <ArrowUpDown className="size-5" />
              </button>
            </div>

            <p className="text-xs font-medium text-muted">{t("conv.to")}</p>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <output className="flex h-12 w-full min-w-0 flex-1 items-center overflow-x-auto rounded-xl bg-surface-2 px-3 font-display text-xl font-bold text-fg tabular-nums">
                {result === null ? "—" : show(result)}
              </output>
              <UnitSelect units={units} value={to} onChange={setTo} label={t("conv.to")} />
            </div>

            {a && b ? (
              <p className="mt-4 text-center text-sm text-muted tabular-nums">
                1 {a.symbol} = {show(a.usd / b.usd)} {b.symbol}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK.map((sym) => {
          const unit = units.find((u) => u.symbol === sym);
          if (!unit) return null;
          return (
            <button
              key={sym}
              type="button"
              onClick={() => setFrom(unit.id)}
              className={cn("h-9 rounded-full px-3.5 text-sm font-semibold", from === unit.id ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-fg")}
            >
              {sym}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-faint">{t("conv.note")}</p>
    </div>
  );
}
