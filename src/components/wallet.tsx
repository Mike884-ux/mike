import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Loader2, Sparkles, Trash2, Wallet as WalletIcon } from "lucide-react";
import { walletRemove, walletTrade } from "@/lib/account";
import { getPrices, getWalletAdvice } from "@/lib/wallet";
import { assetOf, symbolOf, TAPE_CRYPTOS, TAPE_STOCKS } from "@/lib/markets";
import { parseAmount } from "@/lib/portfolio-math";
import { formatDate, useT, type MessageKey } from "@/lib/i18n";
import { useSettings } from "@/lib/settings-store";
import { ACCOUNT_KEY, useAccount } from "@/lib/use-account";
import { formatPct, formatPrice, formatUsd, stripMd } from "@/lib/utils";
import { WalletChart } from "@/components/wallet-chart";
import { Card, aiErrorKey } from "@/components/ui-bits";

const DAY_MS = 86_400_000;

type Note = { tone: "ok" | "error"; text: string } | null;

export function Wallet() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const client = useQueryClient();
  const account = useAccount();
  const positions = useMemo(() => account.data?.positions ?? [], [account.data]);
  const transactions = useMemo(() => account.data?.transactions ?? [], [account.data]);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [base, setBase] = useState<string>(TAPE_CRYPTOS[0]);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [memo, setMemo] = useState("");
  const [note, setNote] = useState<Note>(null);

  const formSymbol = useMemo(() => {
    const asset = assetOf(base);
    return asset ? symbolOf(asset) : "";
  }, [base]);
  const symbols = useMemo(
    () => [...new Set([...positions.map((p) => p.symbol), formSymbol].filter(Boolean))],
    [positions, formSymbol],
  );
  const prices = useQuery({
    queryKey: ["wallet-prices", symbols.join(",")],
    queryFn: () => getPrices({ data: { symbols } }),
    enabled: symbols.length > 0,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
  const priceBySymbol = useMemo(() => new Map((prices.data ?? []).map((row) => [row.symbol, row])), [prices.data]);

  const rows = positions.map((pos) => {
    const live = priceBySymbol.get(pos.symbol);
    const priced = Boolean(live?.price);
    const now = live?.price || pos.entry;
    const value = now * pos.qty;
    const cost = pos.entry * pos.qty;
    const pnl = value - cost;
    return {
      ...pos,
      now,
      priced,
      value,
      cost,
      pnl,
      pnlPct: cost > 0 ? (pnl / cost) * 100 : 0,
      days: Math.floor((Date.now() - pos.openedAt) / DAY_MS),
    };
  });
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const unrealized = totalValue - totalCost;
  const realized = transactions.reduce((s, tx) => s + (tx.realizedPnl ?? 0), 0);

  const trade = useMutation({
    mutationFn: (input: { side: "buy" | "sell"; base: string; qty: number; price: number; note?: string }) => walletTrade({ data: input }),
    onSuccess: (res, input) => {
      if (!res.ok) {
        setNote({ tone: "error", text: t(`wallet.err.${res.error}` as MessageKey) });
        return;
      }
      setNote({
        tone: "ok",
        text:
          input.side === "buy"
            ? t("wallet.ok.buy", { base: input.base })
            : t("wallet.ok.sell", { base: input.base, pnl: `${(res.realizedPnl ?? 0) >= 0 ? "+" : ""}${formatUsd(res.realizedPnl ?? 0)}` }),
      });
      setQty("");
      setMemo("");
      void client.invalidateQueries({ queryKey: ACCOUNT_KEY });
    },
    onError: () => setNote({ tone: "error", text: t("wallet.err.save") }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => walletRemove({ data: { id } }),
    onSettled: () => void client.invalidateQueries({ queryKey: ACCOUNT_KEY }),
  });

  const advice = useMutation({ mutationFn: () => getWalletAdvice({ data: { lang } }) });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = parseAmount(qty);
    const p = parseAmount(price);
    if (!assetOf(base)) return setNote({ tone: "error", text: t("wallet.err.asset") });
    if (!(q > 0)) return setNote({ tone: "error", text: t("wallet.err.qty") });
    if (!(p > 0)) return setNote({ tone: "error", text: t("wallet.err.price") });
    trade.mutate({ side, base, qty: q, price: p, note: memo.trim() || undefined });
  }

  const marketPrice = priceBySymbol.get(formSymbol)?.price;
  const sellable = rows.map((r) => r.base);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-fg sm:text-3xl">
          <WalletIcon className="size-6 text-primary" />
          {t("wallet.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("wallet.subtitle")}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] text-faint">{t("wallet.total")}</p>
          <p className="mt-1 font-mono text-2xl text-fg tabular-nums">{formatUsd(totalValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-faint">{t("wallet.unrealized")}</p>
          <p className={`mt-1 font-mono text-2xl tabular-nums ${unrealized >= 0 ? "text-long" : "text-short"}`}>
            {unrealized >= 0 ? "+" : ""}
            {formatUsd(unrealized)}
            <span className="ml-1.5 text-sm">{totalCost > 0 ? formatPct((unrealized / totalCost) * 100) : ""}</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-faint">{t("wallet.realized")}</p>
          <p className={`mt-1 font-mono text-2xl tabular-nums ${realized >= 0 ? "text-long" : "text-short"}`}>
            {realized >= 0 ? "+" : ""}
            {formatUsd(realized)}
          </p>
        </Card>
      </div>

      <Card className="mt-3 p-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1" role="radiogroup">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={side === s}
                onClick={() => {
                  setSide(s);
                  setNote(null);
                  if (s === "sell" && sellable.length && !sellable.includes(base)) setBase(sellable[0]!);
                }}
                className={`flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium ${
                  side === s ? (s === "buy" ? "bg-long text-bg" : "bg-short text-white") : "text-muted hover:text-fg"
                }`}
              >
                {s === "buy" ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {t(s === "buy" ? "wallet.buy" : "wallet.sell")}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-faint">{t("wallet.asset")}</span>
            <select
              value={base}
              onChange={(event) => setBase(event.target.value)}
              className="h-9 rounded-lg bg-surface-2 px-2.5 font-mono text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {side === "sell" && sellable.length ? (
                sellable.map((sym) => (
                  <option key={sym} value={sym} className="bg-bg">
                    {sym}
                  </option>
                ))
              ) : (
                <>
                  <optgroup label={t("wallet.crypto")}>
                    {TAPE_CRYPTOS.map((sym) => (
                      <option key={sym} value={sym} className="bg-bg">
                        {sym}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t("wallet.stocks")}>
                    {TAPE_STOCKS.map((sym) => (
                      <option key={sym} value={sym} className="bg-bg">
                        {sym}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-faint">{t("wallet.qty")}</span>
            <input
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="h-9 w-28 rounded-lg bg-surface-2 px-2.5 font-mono text-sm text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="flex items-center justify-between gap-2 text-xs text-faint">
              <label htmlFor="wallet-price">{t("wallet.price")}</label>
              {marketPrice ? (
                <button type="button" onClick={() => setPrice(String(marketPrice))} className="text-primary hover:underline">
                  {t("wallet.marketPrice")}
                </button>
              ) : null}
            </span>
            <input
              id="wallet-price"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="decimal"
              placeholder={marketPrice ? formatPrice(marketPrice) : "0"}
              className="h-9 w-32 rounded-lg bg-surface-2 px-2.5 font-mono text-sm text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
          <label className="flex min-w-32 flex-1 flex-col gap-1">
            <span className="text-xs text-faint">{t("wallet.note")}</span>
            <input
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              maxLength={200}
              placeholder={t("wallet.notePlaceholder")}
              className="h-9 rounded-lg bg-surface-2 px-2.5 text-sm text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
          <button
            type="submit"
            disabled={trade.isPending}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold disabled:opacity-60 ${
              side === "buy" ? "bg-long text-bg" : "bg-short text-white"
            }`}
          >
            {trade.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t(side === "buy" ? "wallet.buy" : "wallet.sell")}
          </button>
          {note ? (
            <p role="status" className={`w-full text-xs ${note.tone === "error" ? "text-short" : "text-long"}`}>
              {note.text}
            </p>
          ) : null}
        </form>
      </Card>

      {account.isLoading ? (
        <div className="mt-3 h-32 animate-pulse rounded-xl bg-surface" />
      ) : rows.length ? (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-faint">
                <th className="px-4 py-3 font-normal">{t("wallet.col.asset")}</th>
                <th className="px-4 py-3 text-right font-normal">{t("wallet.col.qty")}</th>
                <th className="px-4 py-3 text-right font-normal">{t("wallet.col.entry")}</th>
                <th className="px-4 py-3 text-right font-normal">{t("wallet.col.now")}</th>
                <th className="px-4 py-3 text-right font-normal">{t("wallet.col.value")}</th>
                <th className="px-4 py-3 text-right font-normal">{t("wallet.col.pnl")}</th>
                <th className="px-4 py-3 text-right font-normal">{t("wallet.col.share")}</th>
                <th className="px-4 py-3 text-right font-normal">{t("wallet.col.days")}</th>
                <th className="px-4 py-3 font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-mono font-semibold text-fg">{row.base}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted tabular-nums">{row.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted tabular-nums">{formatPrice(row.entry)}</td>
                  <td className="px-4 py-3 text-right font-mono text-fg tabular-nums">{row.priced ? formatPrice(row.now) : prices.isLoading ? "…" : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-fg tabular-nums">{formatUsd(row.value)}</td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${row.pnl >= 0 ? "text-long" : "text-short"}`}>
                    {row.pnl >= 0 ? "+" : ""}
                    {formatUsd(row.pnl)}
                    <span className="ml-1 text-xs">({formatPct(row.pnlPct)})</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-faint tabular-nums">
                    {totalValue > 0 ? `${((row.value / totalValue) * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-faint tabular-nums">{row.days}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSide("sell");
                          setBase(row.base);
                          setQty(String(row.qty));
                          if (row.priced) setPrice(String(row.now));
                          setNote(null);
                        }}
                        className="rounded-md px-2 py-1 text-xs text-short hover:bg-short/10"
                      >
                        {t("wallet.sell")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t("wallet.confirmRemove", { base: row.base }))) remove.mutate(row.id);
                        }}
                        aria-label={t("wallet.remove", { base: row.base })}
                        title={t("wallet.remove", { base: row.base })}
                        className="rounded-md p-1 text-faint hover:text-short"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <p className="mt-6 text-sm text-muted">{t("wallet.empty")}</p>
      )}

      {rows.length ? <WalletChart positions={rows.map((r) => ({ symbol: r.symbol, qty: r.qty }))} /> : null}

      {rows.length ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => advice.mutate()}
            disabled={advice.isPending}
            className="bg-brand flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-[var(--shadow-glow)] disabled:opacity-60"
          >
            {advice.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {advice.data?.ok ? t("wallet.adviceRefresh") : t("wallet.advice")}
          </button>
          {advice.isPending ? <p className="mt-2 shimmer-text text-xs">{t("wallet.adviceThinking")}</p> : null}
          {advice.isError ? <p className="mt-2 text-xs text-short">{t("aiErr.unavailable")}</p> : null}
          {!advice.isPending && advice.data?.ok ? (
            <Card className="fade-up mt-3 p-4">
              <p className="text-sm leading-relaxed whitespace-pre-line text-fg">{stripMd(advice.data.text)}</p>
            </Card>
          ) : null}
          {!advice.isPending && advice.data && !advice.data.ok ? (
            <p className="mt-2 text-xs text-short">{t(aiErrorKey(advice.data.reason))}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        <p className="text-xs font-medium tracking-wide text-faint uppercase">{t("wallet.history")}</p>
        {transactions.length ? (
          <Card className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-faint">
                  <th className="px-4 py-2.5 font-normal">{t("wallet.tx.date")}</th>
                  <th className="px-4 py-2.5 font-normal">{t("wallet.tx.side")}</th>
                  <th className="px-4 py-2.5 font-normal">{t("wallet.col.asset")}</th>
                  <th className="px-4 py-2.5 text-right font-normal">{t("wallet.col.qty")}</th>
                  <th className="px-4 py-2.5 text-right font-normal">{t("wallet.price")}</th>
                  <th className="px-4 py-2.5 text-right font-normal">{t("wallet.tx.pnl")}</th>
                  <th className="px-4 py-2.5 font-normal">{t("wallet.note")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted">{formatDate(lang, tx.at)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tx.side === "buy" ? "bg-long/15 text-long" : "bg-short/15 text-short"}`}>
                        {t(tx.side === "buy" ? "wallet.buy" : "wallet.sell")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-fg">{tx.base}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted tabular-nums">{tx.qty}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted tabular-nums">{formatPrice(tx.price)}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                        tx.realizedPnl === null ? "text-faint" : tx.realizedPnl >= 0 ? "text-long" : "text-short"
                      }`}
                    >
                      {tx.realizedPnl === null ? "—" : `${tx.realizedPnl >= 0 ? "+" : ""}${formatUsd(tx.realizedPnl)}`}
                    </td>
                    <td className="max-w-48 truncate px-4 py-2.5 text-xs text-faint">{tx.note === "import" ? "↺" : (tx.note ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("wallet.noTx")}</p>
        )}
      </div>

      <p className="mt-4 pb-6 text-[11px] leading-relaxed text-faint">{t("common.disclaimer")}</p>
    </div>
  );
}
