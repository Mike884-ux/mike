import { Link } from "@tanstack/react-router";
import { Crown, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";
import { PLAN_LABEL } from "@/lib/plans";
import { useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";
import { aiErrorKey } from "@/components/ui-bits";

/** Shown when today's AI allowance is used up: what the next plan gives, and a way there. */
export function LimitUpsell({ className }: { className?: string }) {
  const t = useT();
  const billing = useBilling().data;

  const onMax = billing?.plan === "max";
  const next = billing?.plan === "pro" ? "max" : "pro";
  return (
    <div
      role="alert"
      className={cn("fade-up rounded-2xl bg-primary/8 p-4 ring-1 ring-primary/25", className)}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Crown className="size-4 text-primary" />
        {t("limit.title")}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {t("credits.limit")}
      </p>
      {onMax ? null : (
        <Link
          to="/pricing"
          className="bg-brand mt-3 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-[var(--shadow-glow)] hover:opacity-95"
        >
          <Sparkles className="size-4" />
          {t("limit.cta", { plan: PLAN_LABEL[next] })}
        </Link>
      )}
    </div>
  );
}

/** An AI error, or the upsell when the reason is the daily limit. */
export function AiFailure({
  reason,
  className,
}: {
  reason: string | undefined;
  className?: string;
}) {
  const t = useT();
  if (reason === "limit") return <LimitUpsell className={cn("mt-2 w-full", className)} />;
  return (
    <p
      role="alert"
      className={cn("rounded-lg bg-short/10 px-3 py-2 text-xs text-short", className)}
    >
      {t(aiErrorKey(reason))}
    </p>
  );
}
