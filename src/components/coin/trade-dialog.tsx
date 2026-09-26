import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Loader2, X } from "lucide-react";
import { walletTrade } from "@/lib/account";
import type { CoinInfo } from "@/lib/coins";
import { usdPrice } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { parseAmount } from "@/lib/portfolio-math";
import { ACCOUNT_KEY } from "@/lib/use-account";
import { cn } from "@/lib/utils";

const TRADE_ERR: Record<string, MessageKey> = {
  bad_input: "wallet.err.bad_input",
  no_position: "wallet.err.no_position",
  not_enough: "wallet.err.not_enough",
  full: "wallet.err.full",
};

/** Record a buy or sell of this coin into the account's portfolio. */
export function TradeDialog({ coin, held, onClose }: { coin: CoinInfo; held: number; onClose: () => void }) {
  const t = useT();
  const client = useQueryClient();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState(() => String(Number(coin.price.toPrecision(coin.price >= 1 ? 8 : 6))));
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const trade = useMutation({
    mutationFn: (input: { side: "buy" | "sell"; qty: number; price: number; note?: string }) =>
      walletTrade({ data: { base: coin.symbol, ...input } }),
    onSuccess: (res, input) => {
      if (!res.ok) return setError(TRADE_ERR[res.error] ?? "wallet.err.bad_input");
      void client.invalidateQueries({ queryKey: ACCOUNT_KEY });
      setDone(
        input.side === "buy"
          ? t("wallet.ok.buy", { base: coin.symbol })
          : t("wallet.ok.sell", { base: coin.symbol, pnl: res.realizedPnl === null ? "—" : usdPrice(res.realizedPnl) }),
      );
    },
    onError: () => setError("wallet.err.save"),
  });

  const submit = () => {
    const q = parseAmount(qty);
    const p = parseAmount(price);
    if (!(q > 0)) return setError("wallet.err.qty");
    if (!(p > 0)) return setError("wallet.err.price");
    setError(null);
    trade.mutate({ side, qty: q, price: p, note: memo.trim() || undefined });
  };

  const total = parseAmount(qty) > 0 && parseAmount(price) > 0 ? parseAmount(qty) * parseAmount(price) : null;
  const field = "h-11 w-full rounded-xl bg-surface-2 px-3 text-sm text-fg outline-none tabular-nums placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t("trade.title", { name: coin.name })} onClick={onClose}>
      <div className="fade-up w-full max-w-md rounded-3xl bg-bg p-5 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-fg">{t("trade.title", { name: coin.name })}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {held > 0 ? t("trade.held", { qty: String(Number(held.toPrecision(8))), symbol: coin.symbol }) : t("trade.none")}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid size-9 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-fg">
            <X className="size-5" />
          </button>
        </div>

        {done ? (
          <div className="mt-5">
            <p role="status" className="rounded-xl bg-long/12 px-4 py-3 text-sm font-medium text-long">
              {done}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDone(null);
                  setQty("");
                }}
                className="h-10 flex-1 rounded-xl bg-surface-2 text-sm font-semibold text-fg hover:bg-surface-3"
              >
                {t("trade.another")}
              </button>
              <a href="/portfolio" className="flex h-10 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-fg">
                {t("nav.portfolio")}
              </a>
            </div>
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={side === s}
                  onClick={() => setSide(s)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors",
                    side === s ? (s === "buy" ? "bg-long text-white" : "bg-short text-white") : "text-muted hover:text-fg",
                  )}
                >
                  {s === "buy" ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                  {t(s === "buy" ? "wallet.buy" : "wallet.sell")}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">
                {t("wallet.qty")}, {coin.symbol}
              </span>
              <input inputMode="decimal" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-xs text-muted">
                {t("wallet.price")}
                <button type="button" onClick={() => setPrice(String(Number(coin.price.toPrecision(coin.price >= 1 ? 8 : 6))))} className="font-medium text-primary hover:opacity-80">
                  {t("wallet.marketPrice")} · {usdPrice(coin.price)}
                </button>
              </span>
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">{t("wallet.note")}</span>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t("wallet.notePlaceholder")} maxLength={200} className={field} />
            </label>
            {total !== null ? (
              <p className="text-sm text-muted">
                {t("trade.total")}: <span className="font-semibold text-fg tabular-nums">{usdPrice(total)}</span>
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="rounded-lg bg-short/10 px-3 py-2 text-sm text-short">
                {t(error)}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={trade.isPending}
              className={cn(
                "mt-1 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60",
                side === "buy" ? "bg-long" : "bg-short",
              )}
            >
              {trade.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t(side === "buy" ? "wallet.buy" : "wallet.sell")}
            </button>
            <p className="text-[11px] leading-relaxed text-faint">{t("trade.note")}</p>
          </form>
        )}
      </div>
    </div>
  );
}
