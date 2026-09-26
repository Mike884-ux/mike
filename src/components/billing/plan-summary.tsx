import { Link } from "@tanstack/react-router";
import { Crown, Gift, Shield, Sparkles, Users } from "lucide-react";
import { useT } from "@/lib/i18n";
import { daysLeft, useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
  return (
    <div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{limit > 0 ? `${used}/${limit}` : "—"}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 100 ? "bg-short" : pct >= 70 ? "bg-wait" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Plan, what's left of today's AI allowance, and the ways to get more — for the account menu. */
export function PlanSummary({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const billing = useBilling().data;
  if (!billing) return <div className="skeleton h-24 w-full" />;
  const paid = billing.plan !== "free" && !billing.trial;
  const name = billing.plan === "max" ? "Max" : billing.plan === "pro" ? "Pro" : "Free";
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          {billing.trial ? (
            <Gift className="size-4 text-wait" />
          ) : paid ? (
            <Crown className="size-4 text-wait" />
          ) : (
            <Sparkles className="size-4 text-primary" />
          )}
          {billing.trial ? t("plan.trial") : t("plan.name", { plan: name })}
        </span>
        {billing.until ? (
          <span className="shrink-0 text-[11px] whitespace-nowrap text-muted">
            {t("plan.daysLeft", { n: daysLeft(billing.until) })}
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        <Meter
          label={t("plan.analysis")}
          used={billing.used.analysis}
          limit={billing.limits.analysis}
        />
        <Meter label={t("plan.chat")} used={billing.used.chat} limit={billing.limits.chat} />
      </div>
      <div className="mt-3 flex gap-1.5">
        <Link
          to="/pricing"
          onClick={onNavigate}
          className={cn(
            "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold",
            paid ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "bg-brand text-white",
          )}
        >
          <Sparkles className="size-3.5" />
          {paid ? t("plan.manage") : t("plan.upgrade")}
        </Link>
        <Link
          to="/pricing"
          hash="invite"
          onClick={onNavigate}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-xs font-semibold text-fg shadow-[var(--shadow-border)]"
        >
          <Users className="size-3.5" />
          {t("plan.invite")}
        </Link>
      </div>
      {billing.isAdmin ? (
        <Link
          to="/admin"
          onClick={onNavigate}
          className="mt-2 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-surface text-xs font-semibold text-fg shadow-[var(--shadow-border)]"
        >
          <Shield className="size-3.5" />
          {t("plan.admin")}
        </Link>
      ) : null}
    </div>
  );
}
