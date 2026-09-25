import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, Trash2, Wallet as WalletIcon } from "lucide-react";
import { getPrices, getWalletAdvice } from "@/lib/wallet";
import { MAX_POSITIONS, useWallet } from "@/lib/wallet-store";
import { assetOf, symbolOf, TAPE_CRYPTOS, TAPE_STOCKS } from "@/lib/markets";
import { parseAmount } from "@/lib/portfolio-math";
import { formatPct, formatPrice, formatUsd, stripMd } from "@/lib/utils";
import { WalletChart } from "@/components/wallet-chart";

const DAY_MS = 86_400_000;

export function Wallet() {
  const { positions, addPosition, removePosition } = useWallet();
  const [base, setBase] = useState<string>(TAPE_CRYPTOS[0]);
  const [qty, setQty] = useState("");
  const [entry, setEntry] = useState("");
  const [formNote, setFormNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const symbols = useMemo(() => positions.map((p) => p.symbol), [positions]);
  const prices = useQuery({
    queryKey: ["wallet-prices", symbols.join(",")],
    queryFn: () => getPrices({ data: { symbols } }),
    enabled: symbols.length > 0,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
  const priceBySymbol = useMemo(() => {
    const map = new Map<string, { price: number; change24h: number }>();
    for (const row of prices.data ?? []) map.set(row.symbol, row);
    return map;
  }, [prices.data]);

  const rows = positions.map((pos) => {
    const live = priceBySymbol.get(pos.symbol);
    // Without a live quote we value the row at its entry, and say so in the table.
    const priced = Boolean(live?.price);
    const price = live?.price || pos.entry;
    const value = price * pos.qty;
    const cost = pos.entry * pos.qty;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    const daysHeld = pos.openedAt ? Math.floor((Date.now() - pos.openedAt) / DAY_MS) : null;
    return { ...pos, price, priced, value, cost, pnl, pnlPct, daysHeld, change24h: live?.change24h };
  });

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // A mutation, not a query: the old query key included live P/L, so every
  // 30-second price tick fired a fresh AI request and burned the rate limit.
  const advice = useMutation({
    mutationFn: () =>
      getWalletAdvice({
        data: {
          positions: rows.map((r) => ({ base: r.base, qty: r.qty, entry: r.entry, price: r.price, pnlPct: r.pnlPct, daysHeld: r.daysHeld })),
          totalPnlPct,
        },
      }),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = parseAmount(qty);
    const e = parseAmount(entry);
    const asset = assetOf(base);
    if (!asset) {
      setFormNote({ tone: "error", text: "Выбери монету из списка." });
      return;
    }
    if (!(q > 0)) {
      setFormNote({ tone: "error", text: "Количество должно быть числом больше нуля, например 0,5." });
      return;
    }
    if (!(e > 0)) {
      setFormNote({ tone: "error", text: "Цена входа должна быть числом больше нуля, например 64000." });
      return;
    }
    const result = addPosition({ base: asset.base, symbol: symbolOf(asset), qty: q, entry: e });
    if (result === "full") {
      setFormNote({ tone: "error", text: `В кошельке уже ${MAX_POSITIONS} позиций. Убери лишнюю, чтобы добавить новую.` });
      return;
    }
    setFormNote({
      tone: "ok",
      text: result === "merged" ? `${asset.base} докуплен: количество сложено, цена входа усреднена.` : `${asset.base} добавлен.`,
    });
    setQty("");
    setEntry("");
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-fg">
            <WalletIcon className="size-5 text-muted" />
            Спотовый кошелёк
          </h1>
          <p className="mt-1 text-sm text-muted">
            Свои позиции — здесь. Кнопка «Совет ИИ» ниже разберёт портфель целиком.
          </p>
        </div>
        {rows.length ? (
          <div className="text-right">
            <p className="font-mono text-xl tabular-nums text-fg">{formatUsd(totalValue)}</p>
            <p className={`font-mono text-sm tabular-nums ${totalPnl >= 0 ? "text-long" : "text-short"}`}>
              {totalPnl >= 0 ? "+" : ""}
              {formatUsd(totalPnl)} ({formatPct(totalPnlPct)})
            </p>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={submit}
        className="mt-5 flex flex-wrap items-end gap-2 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint" htmlFor="wallet-base">
            Монета
          </label>
          <select
            id="wallet-base"
            value={base}
            onChange={(event) => setBase(event.target.value)}
            className="h-9 rounded-sm bg-surface-2 px-2.5 font-mono text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <optgroup label="Крипто">
              {TAPE_CRYPTOS.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </optgroup>
            <optgroup label="Акции">
              {TAPE_STOCKS.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint" htmlFor="wallet-qty">
            Количество
          </label>
          <input
            id="wallet-qty"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="h-9 w-32 rounded-sm bg-surface-2 px-2.5 font-mono text-sm text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint" htmlFor="wallet-entry">
            Цена входа, $
          </label>
          <input
            id="wallet-entry"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="h-9 w-32 rounded-sm bg-surface-2 px-2.5 font-mono text-sm text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-sm bg-primary px-4 text-sm font-medium text-primary-fg outline-none transition-[opacity,transform] duration-[var(--motion-quick)] ease-[var(--ease-out)] active:scale-[0.97] hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          Добавить
        </button>
        {formNote ? (
          <p role="status" className={`w-full text-xs ${formNote.tone === "error" ? "text-short" : "text-long"}`}>
            {formNote.text}
          </p>
        ) : null}
      </form>

      {rows.length ? (
        <div className="mt-4 overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-faint">
                <th className="px-4 py-3 font-normal">Монета</th>
                <th className="px-4 py-3 font-normal">Кол-во</th>
                <th className="px-4 py-3 font-normal">Вход</th>
                <th className="px-4 py-3 font-normal">Сейчас</th>
                <th className="px-4 py-3 font-normal">Стоимость</th>
                <th className="px-4 py-3 font-normal">P/L</th>
                <th className="px-4 py-3 font-normal">Доля</th>
                <th className="px-4 py-3 font-normal">Дней</th>
                <th className="px-4 py-3 font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-mono font-medium text-fg">{row.base}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted">{row.qty}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-muted">{formatPrice(row.entry)}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-fg" title={row.priced ? undefined : "Нет котировки, считаю по цене входа"}>
                    {row.priced ? formatPrice(row.price) : prices.isLoading ? "…" : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-fg">{formatUsd(row.value)}</td>
                  <td className={`px-4 py-3 font-mono tabular-nums ${row.pnl >= 0 ? "text-long" : "text-short"}`}>
                    {row.pnl >= 0 ? "+" : ""}
                    {formatUsd(row.pnl)}
                    <span className="ml-1 text-xs">({formatPct(row.pnlPct)})</span>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-faint">
                    {totalValue > 0 ? `${((row.value / totalValue) * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-faint">{row.daysHeld !== null ? row.daysHeld : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removePosition(row.id)}
                      aria-label={`Убрать ${row.base}`}
                      className="text-faint outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-short focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">
          Кошелёк пуст. Добавь первую позицию — цену будем подтягивать с рынка сами.
        </p>
      )}

      {rows.length ? <WalletChart positions={rows.map((r) => ({ symbol: r.symbol, qty: r.qty }))} /> : null}

      {rows.length ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => advice.mutate()}
            disabled={advice.isPending}
            className="flex h-9 items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-medium text-primary-fg outline-none transition-[opacity,transform] duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {advice.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {advice.data ? "Обновить совет ИИ" : "Совет ИИ по портфелю"}
          </button>

          {advice.isPending ? <p className="mt-2 shimmer-text text-xs">ИИ смотрит портфель</p> : null}
          {advice.isError ? <p className="mt-2 text-xs text-short">ИИ сейчас не ответил. Попробуй ещё раз.</p> : null}
          {!advice.isPending && advice.data?.ok ? (
            <div className="mt-3 rounded-sm bg-surface-2 p-3">
              <p className="text-xs leading-relaxed text-fg">{stripMd(advice.data.text)}</p>
            </div>
          ) : null}
          {!advice.isPending && advice.data && !advice.data.ok ? (
            <p className="mt-2 text-xs text-short">{advice.data.error}</p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        Кошелёк хранится только в этом браузере. Это не инвестиционная рекомендация.
      </p>
    </div>
  );
}
