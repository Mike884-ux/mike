import { useState } from "react";
import { useCoinImages } from "@/lib/coin-images";
import type { AssetKind } from "@/lib/markets";
import { cn } from "@/lib/utils";

/** Company sites for stock logos (served as favicons by Google). */
const STOCK_LOGO_DOMAIN: Record<string, string> = {
  AAPL: "apple.com",
  NVDA: "nvidia.com",
  TSLA: "tesla.com",
  MSFT: "microsoft.com",
  AMZN: "amazon.com",
  GOOG: "google.com",
  META: "meta.com",
  NFLX: "netflix.com",
  AMD: "amd.com",
  INTC: "intel.com",
  ORCL: "oracle.com",
  CRM: "salesforce.com",
  ADBE: "adobe.com",
  PYPL: "paypal.com",
  DIS: "disney.com",
  KO: "coca-cola.com",
  WMT: "walmart.com",
  JPM: "jpmorganchase.com",
  V: "visa.com",
  MA: "mastercard.com",
  BAC: "bankofamerica.com",
  BABA: "alibaba.com",
  UBER: "uber.com",
  PLTR: "palantir.com",
  COIN: "coinbase.com",
  MSTR: "strategy.com",
  IBM: "ibm.com",
  SBER: "sberbank.ru",
};

/** Where to look for a logo, best first; the letters badge comes after the last one fails. */
function sources(base: string, kind: AssetKind, images: Record<string, string> | undefined): string[] {
  const upper = base.toUpperCase();
  if (kind === "crypto") {
    return [images?.[upper], `https://assets.coincap.io/assets/icons/${base.toLowerCase()}@2x.png`].filter((s): s is string => Boolean(s));
  }
  const domain = STOCK_LOGO_DOMAIN[upper];
  return domain ? [`https://www.google.com/s2/favicons?domain=${domain}&sz=64`] : [];
}

export function AssetIcon({ base, kind, className }: { base: string; kind: AssetKind; className?: string }) {
  const images = useCoinImages().data;
  const [failed, setFailed] = useState(0);
  const src = sources(base, kind, images)[failed];

  if (!src) {
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
      key={src}
      src={src}
      alt=""
      loading="lazy"
      className={cn("size-7 shrink-0 rounded-full bg-surface-2 object-contain", className)}
      onError={() => setFailed((n) => n + 1)}
    />
  );
}
