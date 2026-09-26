import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Bot, Compass, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";
import { useSettings } from "@/lib/settings-store";
import { getStrategyAdvice, HORIZONS, RISKS, type Horizon, type Risk, type StrategyPlan } from "@/lib/strategy";
import { cn, stripMd } from "@/lib/utils";
import { Chat } from "@/components/chat";
import { aiErrorKey } from "@/components/ui-bits";

const ALLOC_COLORS = ["bg-primary", "bg-accent", "bg-wait", "bg-long", "bg-short", "bg-faint"];

function Choice<T extends string>({ label, options, value, onChange, names }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; names: Record<T, MessageKey> }) {
  const t = useT();
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={cn("h-9 flex-1 rounded-lg px-2 text-sm font-semibold", value === o ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted hover:text-fg")}
          >
            {t(names[o])}
          </button>
        ))}
      </div>
    </div>
  );
}

function ListBlock({ title, items, marker = "•", tone }: { title: string; items: string[]; marker?: string; tone?: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-faint uppercase">{title}</p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-fg">
            <span className={cn("shrink-0", tone ?? "text-primary")}>{marker}</span>
            <span>{stripMd(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanView({ plan }: { plan: StrategyPlan }) {
  const t = useT();
  return (
    <div className="fade-up mt-4 flex flex-col gap-5 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div>
        <h2 className="font-display text-xl font-bold text-fg">{stripMd(plan.title)}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{stripMd(plan.summary)}</p>
      </div>
      <div className="rounded-xl bg-surface-2 p-3.5">
        <p className="text-[11px] font-semibold tracking-wide text-faint uppercase">{t("strategy.market")}</p>
        <p className="mt-1 text-sm leading-relaxed text-fg">{stripMd(plan.marketRead)}</p>
      </div>
      {plan.allocation.length ? (
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-faint uppercase">{t("strategy.allocation")}</p>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            {plan.allocation.map((a, i) => (
              <span key={a.asset} className={cn("h-full", ALLOC_COLORS[i % ALLOC_COLORS.length])} style={{ width: `${a.sharePct}%` }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {plan.allocation.map((a, i) => (
              <li key={a.asset} className="flex gap-2.5 text-sm">
                <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", ALLOC_COLORS[i % ALLOC_COLORS.length])} />
                <span className="w-12 shrink-0 font-semibold text-fg tabular-nums">{a.sharePct}%</span>
                <span className="text-fg">
                  <span className="font-semibold">{a.asset}</span> <span className="text-muted">— {stripMd(a.why)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <ListBlock title={t("strategy.rules")} items={plan.rules} marker="→" />
        <ListBlock title={t("strategy.entries")} items={plan.entries} marker="◎" tone="text-long" />
      </div>
      <ListBlock title={t("strategy.portfolio")} items={plan.portfolioNotes} marker="▸" tone="text-accent" />
      <ListBlock title={t("ai.risks")} items={plan.risks} marker="!" tone="text-short" />
      <p className="border-t border-border pt-3 text-sm text-muted">
        <span className="font-semibold text-fg">{t("strategy.review")}: </span>
        {stripMd(plan.nextReview)}
      </p>
      <p className="text-[11px] leading-relaxed text-faint">{t("common.disclaimer")}</p>
    </div>
  );
}

const RISK_NAMES: Record<Risk, MessageKey> = { low: "strategy.risk.low", medium: "strategy.risk.medium", high: "strategy.risk.high" };
const HORIZON_NAMES: Record<Horizon, MessageKey> = { short: "strategy.horizon.short", medium: "strategy.horizon.medium", long: "strategy.horizon.long" };

function Strategies() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const [risk, setRisk] = useState<Risk>("medium");
  const [horizon, setHorizon] = useState<Horizon>("medium");
  const advice = useMutation({ mutationFn: () => getStrategyAdvice({ data: { risk, horizon, lang } }) });
  const result = advice.data;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-fg sm:text-3xl">
        <Compass className="size-6 text-primary" />
        {t("strategy.title")}
      </h1>
      <p className="mt-1 text-sm text-muted">{t("strategy.subtitle")}</p>
      <div className="mt-4 grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-2">
        <Choice label={t("strategy.riskLabel")} options={RISKS} value={risk} onChange={setRisk} names={RISK_NAMES} />
        <Choice label={t("strategy.horizonLabel")} options={HORIZONS} value={horizon} onChange={setHorizon} names={HORIZON_NAMES} />
        <button
          type="button"
          onClick={() => advice.mutate()}
          disabled={advice.isPending}
          className="bg-brand flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-[var(--shadow-glow)] disabled:opacity-60 sm:col-span-2"
        >
          {advice.isPending ? <Loader2 className="size-4 animate-spin" /> : result?.ok ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
          {advice.isPending ? t("strategy.thinking") : result?.ok ? t("strategy.rebuild") : t("strategy.build")}
        </button>
      </div>
      {advice.isPending ? (
        <div className="mt-4 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="shimmer-text text-sm">{t("strategy.thinking")}</p>
          <p className="mt-1 text-xs text-faint">{t("ai.thinkingHint")}</p>
        </div>
      ) : null}
      {result && !result.ok && !advice.isPending ? (
        <p role="alert" className="mt-4 rounded-xl bg-short/10 px-4 py-3 text-sm text-short">
          {t(aiErrorKey(result.reason))}
        </p>
      ) : null}
      {advice.isError ? <p className="mt-4 text-sm text-short">{t("aiErr.unavailable")}</p> : null}
      {result?.ok && !advice.isPending ? <PlanView plan={result.plan} /> : null}
      {!result && !advice.isPending ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["strategy.tip1", "strategy.tip2", "strategy.tip3"] as MessageKey[]).map((key) => (
            <p key={key} className="rounded-2xl bg-surface p-4 text-sm leading-relaxed text-muted shadow-[var(--shadow-border)]">
              {t(key)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AiPage({ question, tab }: { question?: string; tab: "chat" | "strategy" }) {
  const t = useT();
  const tabs = [
    { id: "chat" as const, label: "ai.tab.chat" as MessageKey, icon: Bot },
    { id: "strategy" as const, label: "ai.tab.strategy" as MessageKey, icon: Compass },
  ];
  return (
    <div>
      <div className="mx-auto mb-4 flex w-full max-w-3xl gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <Link
              key={item.id}
              to="/ai"
              search={{ tab: item.id === "chat" ? undefined : item.id, q: undefined }}
              role="tab"
              aria-selected={active}
              className={cn("flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold", active ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted hover:text-fg")}
            >
              <Icon className="size-4" />
              {t(item.label)}
            </Link>
          );
        })}
      </div>
      {tab === "strategy" ? (
        <Strategies />
      ) : (
        <div className="h-[calc(100dvh-16rem)] min-h-[520px]">
          <Chat initialQuestion={question} />
        </div>
      )}
    </div>
  );
}
