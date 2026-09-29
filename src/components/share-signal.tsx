import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, Loader2, Send, Share2, X } from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";
import type { AiVerdict } from "@/lib/coin-detail";
import type { CoinRow } from "@/lib/scan";
import { drawShareCard } from "@/lib/share-card";
import { INTERVALS, type IntervalId } from "@/lib/types";
import { useBilling } from "@/lib/use-billing";
import { cn, formatPrice } from "@/lib/utils";

function useShareLink(): string {
  const refCode = useBilling().data?.refCode;
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/${refCode ? `?ref=${refCode}` : ""}`;
}

function ShareDialog({ row, interval, verdict, onClose }: { row: CoinRow; interval: IntervalId; verdict?: AiVerdict; onClose: () => void }) {
  const t = useT();
  const link = useShareLink();
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const label = INTERVALS.find((i) => i.id === interval)?.label ?? interval;
  // The AI's call when it has been asked; otherwise an invitation to the AI analysis — never the raw indicators.
  const callLabel = verdict ? t("share.aiCall", { call: t(`action.${verdict.direction}` as MessageKey) }) : t("share.aiNone");
  const text = verdict
    ? t("share.text", { base: row.base, call: t(`action.${verdict.direction}` as MessageKey), n: verdict.confidence, link })
    : t("share.textNoAi", { base: row.base, link });

  const input = useMemo(
    () => ({
      base: row.base,
      price: `$${formatPrice(row.price)}`,
      change24h: row.change24h,
      tone: verdict?.direction ?? ("NONE" as const),
      callLabel,
      confidence: verdict ? verdict.confidence : null,
      confidenceText: verdict ? t("share.confidence", { n: verdict.confidence }) : t("share.askAi"),
      interval: label,
      facts: [
        `RSI ${Math.round(row.rsi)}`,
        `${t("scan.col.trend")}: ${t(`trend.${row.trend}` as MessageKey)}`,
        `${t("scan.col.volume")} ${row.volumeRatio.toFixed(1)}×`,
      ],
      appName: t("app.name"),
      tagline: t("share.tagline"),
      link: link.replace(/^https?:\/\//, ""),
      footnote: t("share.nfa"),
    }),
    [row, label, verdict, callLabel, link, t],
  );

  useEffect(() => {
    let url = "";
    let alive = true;
    drawShareCard(input)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ url, file: new File([blob], `skan-${row.base.toLowerCase()}.png`, { type: "image/png" }) });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [input, row.base]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = image.file.name;
    a.click();
  };

  const toTelegram = async () => {
    // Phones: the system share sheet sends the picture itself (Telegram included).
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (image && nav.canShare?.({ files: [image.file] })) {
      try {
        await nav.share({ files: [image.file], text });
        return;
      } catch {
        /* cancelled — fall back to the link */
      }
    }
    // Desktop: save the picture and open Telegram with the text and link ready.
    download();
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t("share.title")} onClick={onClose}>
      <div className="fade-up w-full max-w-lg rounded-3xl bg-bg p-5 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-fg">{t("share.title")}</h2>
            <p className="mt-0.5 text-sm text-muted">{t("share.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid size-9 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-fg">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl bg-surface-2">
          {image ? (
            <img src={image.url} alt={text} className="block aspect-[16/9] w-full" />
          ) : (
            <div className="grid aspect-[16/9] place-items-center text-sm text-muted">{failed ? t("share.failed") : <Loader2 className="size-6 animate-spin" />}</div>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <button
            type="button"
            disabled={!image}
            onClick={() => void toTelegram()}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60"
          >
            <Send className="size-4" />
            {t("share.telegram")}
          </button>
          <button type="button" disabled={!image} onClick={download} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-semibold text-fg hover:bg-surface-3 disabled:opacity-60">
            <Download className="size-4" />
            {t("share.download")}
          </button>
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard?.writeText(`${text}`).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              })
            }
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-semibold text-fg hover:bg-surface-3"
          >
            {copied ? <Check className="size-4 text-long" /> : <Copy className="size-4" />}
            {t(copied ? "ref.copied" : "share.copy")}
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-faint">{t("share.hint")}</p>
      </div>
    </div>,
    document.body,
  );
}

/** "Share to Telegram" for a coin: a branded picture card with the AI's call, plus the member's invite link. */
export function ShareSignalButton({ row, interval, verdict, compact, className }: { row: CoinRow; interval: IntervalId; verdict?: AiVerdict; compact?: boolean; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(event) => event.stopPropagation()}
        aria-label={t("share.title")}
        title={t("share.title")}
        className={cn(
          compact
            ? "grid size-7 place-items-center rounded-md bg-[#229ED9]/12 text-[#229ED9] hover:bg-[#229ED9]/20"
            : "flex h-10 items-center gap-2 rounded-xl bg-[#229ED9] px-4 text-sm font-semibold text-white hover:brightness-105",
          className,
        )}
      >
        <Share2 className={compact ? "size-3.5" : "size-4"} />
        {compact ? null : t("share.button")}
      </button>
      {open ? <ShareDialog row={row} interval={interval} verdict={verdict} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
