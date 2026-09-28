import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";
import { AI_CREDIT_COST, type AiKind } from "@/lib/plans";
import { useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";

const KIND_LEFT: Record<AiKind, MessageKey> = {
  analysis: "quota.analysis",
  chat: "quota.chat",
  advice: "quota.advice",
  strategy: "quota.strategy",
};

/**
 * "2 of 3 free AI breakdowns left today — Pro for more": always visible next to
 * AI buttons, so the limit never comes as a surprise and the upgrade is one tap.
 */
export function QuotaNote({ kind, className }: { kind: AiKind; className?: string }) {
  const t = useT();
  const billing = useBilling().data;
  if (!billing) return null;
  const limit = billing.limits[kind];
  if (limit <= 0) return null;
  const creditsLeft = Math.max(0, billing.credits.limit - billing.credits.used);
  const left = Math.max(0, Math.min(limit - billing.used[kind], Math.floor(creditsLeft / AI_CREDIT_COST[kind])));
  const paid = billing.plan !== "free" && !billing.trial;
  const low = left <= Math.max(1, Math.floor(limit * 0.2));
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", low ? "text-short" : "text-muted", className)}>
      <span className="tabular-nums">{t(KIND_LEFT[kind], { n: left, total: limit })}</span>
      <span>{t("credits.balance", { n: creditsLeft, total: billing.credits.limit })} · {t("credits.cost", { n: AI_CREDIT_COST[kind] })}</span>
      {billing.plan === "max" ? null : (
        <Link to="/pricing" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          <Sparkles className="size-3" />
          {t(paid ? "quota.moreWhale" : "quota.more")}
        </Link>
      )}
    </p>
  );
}
