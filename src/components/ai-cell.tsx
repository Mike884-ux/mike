import type { KeyboardEvent, MouseEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { analyzeChartAi, type AiVerdict } from "@/lib/coin-detail";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings-store";
import type { IntervalId } from "@/lib/types";
import { BILLING_KEY } from "@/lib/use-billing";
import { cn } from "@/lib/utils";
import { aiErrorKey, SignalBadge } from "@/components/ui-bits";

/** The AI's call on one asset: its verdict when there is one, else a button to ask. */
export function AiCell({
  base,
  interval,
  verdict,
  onAnswer,
  className,
}: {
  base: string;
  interval: IntervalId;
  verdict: AiVerdict | undefined;
  onAnswer: (base: string, verdict: AiVerdict) => void;
  className?: string;
}) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const client = useQueryClient();
  const ask = useMutation({
    mutationFn: () => analyzeChartAi({ data: { base, interval, lang } }),
    onSuccess: (res) => {
      if (!res.ok) return;
      // The coin window reads the same answer without asking again.
      client.setQueryData(["chart-ai", base, interval, lang], res);
      onAnswer(base, { direction: res.levels.direction, confidence: res.levels.confidence });
    },
    onSettled: () => void client.invalidateQueries({ queryKey: BILLING_KEY }),
  });
  // Clicks here must not open the row underneath.
  const stop = { onClick: (e: MouseEvent) => e.stopPropagation(), onKeyDown: (e: KeyboardEvent) => e.stopPropagation() };

  if (verdict) {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)} title={t("scan.ai.verdictHint")}>
        <SignalBadge signal={verdict.direction} />
        <span className="font-mono text-[11px] text-muted tabular-nums">{verdict.confidence}%</span>
      </span>
    );
  }
  if (ask.isPending) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[11px] text-primary", className)} role="status">
        <Loader2 className="size-3.5 animate-spin" />
        <span className="shimmer-text">{t("scan.ai.thinking")}</span>
      </span>
    );
  }
  const failure = ask.data && !ask.data.ok ? ask.data.reason : ask.isError ? "unavailable" : null;
  if (failure === "limit") {
    return (
      <Link to="/pricing" {...stop} className={cn("inline-flex items-center gap-1 text-[11px] font-semibold text-wait hover:underline", className)}>
        {t("scan.ai.limit")}
      </Link>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <button
        type="button"
        {...stop}
        onClick={(e) => {
          e.stopPropagation();
          ask.mutate();
        }}
        title={failure ? t(aiErrorKey(failure)) : undefined}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          failure ? "bg-short/10 text-short hover:bg-short/15" : "bg-primary/12 text-primary hover:bg-primary/20",
        )}
      >
        {failure ? <RotateCcw className="size-3" /> : <Sparkles className="size-3" />}
        {failure ? t("scan.ai.retry") : t("scan.ai.ask")}
      </button>
    </span>
  );
}
