import type { SyntheticEvent } from "react";
import { ArrowLeftRight } from "lucide-react";
import { isTradable } from "@/lib/exchanges";
import { useT } from "@/lib/i18n";
import { useTradePicker } from "@/lib/use-exchanges";
import { cn } from "@/lib/utils";

/**
 * One "Trade" button: opens the exchange picker for the coin, which suggests
 * where it can actually be bought from the visitor's country. `compact` fits a
 * table row; `full` is a wide button for coin windows.
 */
export function TradeButton({
  symbol,
  name,
  variant = "compact",
  className,
}: {
  symbol: string;
  name?: string;
  variant?: "compact" | "full";
  className?: string;
}) {
  const t = useT();
  const openFor = useTradePicker((s) => s.openFor);
  if (!isTradable(symbol)) return null;
  // Buttons sit inside clickable rows: don't open the row too.
  const stop = (event: SyntheticEvent) => event.stopPropagation();
  return (
    <button
      type="button"
      onClick={(event) => {
        stop(event);
        openFor(symbol, name);
      }}
      onKeyDown={stop}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-bold whitespace-nowrap outline-none transition focus-visible:ring-2 focus-visible:ring-primary/50",
        variant === "compact"
          ? "h-7 rounded-lg bg-primary/12 px-2.5 text-[11px] text-primary hover:bg-primary/20"
          : "bg-brand h-11 rounded-xl px-4 text-sm text-white shadow-[var(--shadow-glow)] hover:opacity-95",
        className,
      )}
    >
      <ArrowLeftRight className={variant === "compact" ? "size-3" : "size-4"} />
      {variant === "compact" ? t("ex.button") : t("ex.buttonFull", { symbol: symbol.toUpperCase() })}
    </button>
  );
}
