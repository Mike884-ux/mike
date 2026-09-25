import { useState } from "react";
import type { AssetKind } from "@/lib/markets";
import { cn } from "@/lib/utils";

const STOCK_LOGO_DOMAIN: Record<string, string> = {
  AAPL: "apple.com",
  NVDA: "nvidia.com",
  TSLA: "tesla.com",
  MSFT: "microsoft.com",
  AMZN: "amazon.com",
  GOOG: "google.com",
  META: "meta.com",
};

export function AssetIcon({ base, kind, className }: { base: string; kind: AssetKind; className?: string }) {
  const [errored, setErrored] = useState(false);
  const src =
    kind === "crypto"
      ? `https://assets.coincap.io/assets/icons/${base.toLowerCase()}@2x.png`
      : STOCK_LOGO_DOMAIN[base]
        ? `https://www.google.com/s2/favicons?domain=${STOCK_LOGO_DOMAIN[base]}&sz=64`
        : undefined;

  if (errored || !src) {
    return (
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] font-semibold text-fg",
          className,
        )}
      >
        {base.slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={cn("size-7 shrink-0 rounded-full bg-surface-2 object-contain", className)}
      onError={() => setErrored(true)}
    />
  );
}
