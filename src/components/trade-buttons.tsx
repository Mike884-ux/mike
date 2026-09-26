import { ExternalLink } from "lucide-react";
import { EXCHANGE_LABEL, EXCHANGES, isTradable, tradeUrl, type Exchange } from "@/lib/exchanges";
import { useT } from "@/lib/i18n";
import { useSiteStatus } from "@/lib/use-billing";
import { cn } from "@/lib/utils";

const STYLE: Record<Exchange, string> = {
  binance: "bg-[#F0B90B] text-[#1E2026] hover:brightness-95",
  bybit: "bg-[#17181E] text-[#F7A600] ring-1 ring-white/10 hover:brightness-125",
};

/**
 * "Trade on Binance / Bybit" for a coin, with the owner's referral code when set.
 * `compact` fits in a table row (`stacked` puts the two chips one above the
 * other for narrow columns); `full` is a pair of wide buttons, and `short`
 * drops "Trade on" from their text where the space is narrow.
 */
export function TradeButtons({
  symbol,
  variant = "full",
  short,
  stacked,
  className,
}: {
  symbol: string;
  variant?: "compact" | "full";
  short?: boolean;
  stacked?: boolean;
  className?: string;
}) {
  const t = useT();
  const refs = useSiteStatus().data?.exchanges;
  if (!isTradable(symbol)) return null;
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  if (variant === "compact") {
    return (
      <span className={cn("inline-flex", stacked ? "flex-col gap-0.5" : "gap-1", className)}>
        {EXCHANGES.map((ex) => (
          <a
            key={ex}
            href={tradeUrl(ex, symbol, refs?.[ex])}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={stop}
            onKeyDown={stop}
            title={t("trade.on", { exchange: EXCHANGE_LABEL[ex] })}
            aria-label={t("trade.on", { exchange: EXCHANGE_LABEL[ex] })}
            className={cn(
              "inline-flex items-center rounded-md px-2 font-bold whitespace-nowrap",
              stacked ? "h-[22px] justify-center text-[10.5px]" : "h-7 text-[11px]",
              STYLE[ex],
            )}
          >
            {EXCHANGE_LABEL[ex]}
          </a>
        ))}
      </span>
    );
  }
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {EXCHANGES.map((ex) => (
        <a
          key={ex}
          href={tradeUrl(ex, symbol, refs?.[ex])}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={stop}
          title={t("trade.on", { exchange: EXCHANGE_LABEL[ex] })}
          aria-label={t("trade.on", { exchange: EXCHANGE_LABEL[ex] })}
          className={cn("flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold whitespace-nowrap", STYLE[ex])}
        >
          {short ? EXCHANGE_LABEL[ex] : t("trade.on", { exchange: EXCHANGE_LABEL[ex] })}
          <ExternalLink className="size-3.5 opacity-70" />
        </a>
      ))}
    </div>
  );
}
