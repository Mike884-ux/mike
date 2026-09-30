import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bitcoin,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Crown,
  Gift,
  Loader2,
  MessageCircle,
  Minus,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { joinWaitlist, startCheckout } from "@/lib/billing";
import { useT, type MessageKey } from "@/lib/i18n";
import {
  AI_KINDS,
  ALERT_LIMITS,
  MONTHLY_CREDITS,
  TRIAL_CREDITS,
  PLANS,
  REFERRAL_BONUS_CAP,
  REFERRAL_BONUS_DAYS,
  REFERRAL_FRIENDS,
  YEAR_DISCOUNT_PCT,
  PLAN_LABEL,
  WAITLIST_GIFT_DAYS,
  priceOf,
  type AiKind,
  type PaidPlan,
  type Period,
  type PaymentOptions,
  type PlanId,
} from "@/lib/plans";
import { BILLING_KEY, daysLeft, useBilling, useSiteStatus } from "@/lib/use-billing";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import { LegalConsent } from "@/components/site/legal-page";

/** Placeholders for the "invite friends" texts. */
const REFERRAL = { friends: REFERRAL_FRIENDS, days: REFERRAL_BONUS_DAYS, cap: REFERRAL_BONUS_CAP };

const KIND_KEY: Record<AiKind, MessageKey> = {
  analysis: "pricing.f.analysis",
  chat: "pricing.f.chat",
  advice: "pricing.f.advice",
  strategy: "pricing.f.strategy",
};

const PLAN_NAME: Record<PlanId, string> = PLAN_LABEL;

/** The signed-in user, but only after hydration: the server render never knows the session. */
function useMember() {
  const { user } = useCurrentUserState();
  return useHydrated() ? user : null;
}

function money(n: number): string {
  return `$${n % 1 ? n.toFixed(2) : n}`;
}

function PeriodSwitch({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const t = useT();
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1"
      role="radiogroup"
      aria-label={t("pricing.period")}
    >
      {(["month", "year"] as const).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={period === p}
          onClick={() => onChange(p)}
          className={cn(
            "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
            period === p
              ? "bg-surface text-fg shadow-[var(--shadow-border)]"
              : "text-muted hover:text-fg",
          )}
        >
          {t(p === "month" ? "pricing.monthly" : "pricing.yearly")}
          {p === "year" ? (
            <span className="rounded-full bg-long/15 px-2 py-0.5 text-[11px] font-bold text-long">
              −{YEAR_DISCOUNT_PCT}%
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function Feature({
  ok,
  children,
  strong,
}: {
  ok: boolean;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <li className={cn("flex gap-2.5 text-sm", ok ? "text-fg" : "text-faint")}>
      {ok ? (
        <Check className="mt-0.5 size-4 shrink-0 text-long" />
      ) : (
        <Minus className="mt-0.5 size-4 shrink-0" />
      )}
      <span className={strong ? "font-semibold" : undefined}>{children}</span>
    </li>
  );
}

function PlanCard({
  plan,
  period,
  current,
  onChoose,
}: {
  plan: PlanId;
  period: Period;
  current: PlanId | null;
  onChoose: (plan: PaidPlan) => void;
}) {
  const t = useT();
  const user = useMember();
  const spec = PLANS[plan];
  const popular = plan === "pro";
  const paid = plan !== "free";
  const perMonth = paid ? (period === "year" ? spec.year / 12 : spec.month) : 0;
  const saving = paid ? spec.month * 12 - spec.year : 0;
  const isCurrent = current === plan;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl bg-surface p-6 shadow-[var(--shadow-border)]",
        popular && "ring-2 ring-primary shadow-[var(--shadow-glow)] lg:-translate-y-2",
      )}
    >
      {popular ? (
        <span className="bg-brand absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
          <Zap className="size-3" />
          {t("pricing.popular")}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        {plan === "max" ? (
          <Crown className="size-5 text-wait" />
        ) : plan === "pro" ? (
          <Sparkles className="size-5 text-primary" />
        ) : (
          <Gift className="size-5 text-accent" />
        )}
        <h2 className="font-display text-xl font-bold text-fg">{PLAN_NAME[plan]}</h2>
      </div>
      <p className="mt-1 text-sm text-muted">{t(`pricing.${plan}.tagline` as MessageKey)}</p>
      <div className="mt-5 flex items-end gap-1">
        <span className="font-display text-4xl font-extrabold text-fg tabular-nums">
          {money(Math.round(perMonth * 100) / 100)}
        </span>
        <span className="pb-1.5 text-sm text-muted">{t("pricing.perMonth")}</span>
      </div>
      <p className="mt-1 h-5 text-xs text-muted">
        {paid
          ? period === "year"
            ? t("pricing.billedYearly", { total: money(spec.year), save: money(saving) })
            : t("pricing.billedMonthly")
          : t("pricing.forever")}
      </p>

      {isCurrent ? (
        <span className="mt-5 flex h-11 items-center justify-center rounded-xl bg-surface-2 text-sm font-semibold text-muted">
          {t("pricing.current")}
        </span>
      ) : !paid ? (
        user ? (
          <span className="mt-5 flex h-11 items-center justify-center rounded-xl bg-surface-2 text-sm font-semibold text-muted">
            {t("pricing.included")}
          </span>
        ) : (
          <Link
            to="/login"
            search={{ mode: "signup", redirect: "/pricing" }}
            className="mt-5 flex h-11 items-center justify-center rounded-xl bg-surface-2 text-sm font-semibold text-fg hover:bg-surface-3"
          >
            {t("pricing.startFree")}
          </Link>
        )
      ) : user ? (
        <button
          type="button"
          onClick={() => onChoose(plan)}
          className={cn(
            "mt-5 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold",
            popular
              ? "bg-brand text-white shadow-[var(--shadow-glow)] hover:opacity-95"
              : "bg-fg text-bg hover:opacity-90",
          )}
        >
          {t("pricing.choose", { plan: PLAN_NAME[plan] })}
        </button>
      ) : plan === "pro" ? (
        <Link
          to="/login"
          search={{ mode: "signup", redirect: "/pricing" }}
          className="bg-brand mt-5 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-[var(--shadow-glow)] hover:opacity-95"
        >
          {t("pricing.tryPro")}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onChoose(plan)}
          className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-fg text-sm font-semibold text-bg hover:opacity-90"
        >
          {t("pricing.choose", { plan: PLAN_NAME[plan] })}
        </button>
      )}

      <ul className="mt-6 flex flex-col gap-2.5 border-t border-border pt-5">
        <Feature ok strong>{t("credits.month", { n: MONTHLY_CREDITS[plan] })}</Feature>
        <Feature ok>{t("pricing.f.market")}</Feature>
        {AI_KINDS.map((kind) => (
          <Feature key={kind} ok={spec.limits[kind] > 0} strong={paid && kind === "analysis"}>
            {spec.limits[kind] > 0
              ? t(KIND_KEY[kind], { n: spec.limits[kind] })
              : t(`${KIND_KEY[kind]}.none` as MessageKey)}
          </Feature>
        ))}
        <Feature ok strong={paid}>{t(plan === "free" ? "pricing.f.alertsFree" : "pricing.f.alerts", { n: ALERT_LIMITS[plan] })}</Feature>
        <Feature ok>{t(plan === "free" ? "pricing.f.screenerFree" : "pricing.f.screener")}</Feature>
        <Feature ok>{t("pricing.f.portfolio")}</Feature>
        {plan === "max" ? <Feature ok>{t("pricing.f.deep")}</Feature> : null}
      </ul>
    </div>
  );
}

function contactHref(contact: string): string {
  if (/^https?:\/\//.test(contact)) return contact;
  if (contact.startsWith("@")) return `https://t.me/${contact.slice(1)}`;
  if (contact.includes("@")) return `mailto:${contact}`;
  return contact;
}

function PayDialog({
  plan,
  period,
  options,
  onClose,
}: {
  plan: PaidPlan;
  period: Period;
  options: PaymentOptions | undefined;
  onClose: () => void;
}) {
  const t = useT();
  const { user } = useCurrentUserState();
  const checkout = useMutation({
    mutationFn: (method: "crypto" | "card") => startCheckout({ data: { plan, period, method } }),
    onSuccess: (res) => {
      if (res.ok) window.location.href = res.url;
    },
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const price = priceOf(plan, period);
  // Online payment not connected yet: collect emails instead (the waiting list).
  const online = Boolean(options?.crypto || options?.card);
  // Plans are switched on for an account, so every way to pay starts with one.
  const payable = online || Boolean(options?.contact);
  // Cards through NOWPayments' on-ramp have a minimum set by its card partner.
  const cardMin = options?.cardMin ?? null;
  const cardTooSmall = cardMin !== null && price < cardMin;
  const failed = checkout.data && !checkout.data.ok;
  const failure = checkout.data && !checkout.data.ok ? checkout.data.error : null;
  const method =
    "flex h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold disabled:opacity-60";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("pay.title")}
      onClick={onClose}
    >
      <div
        className="fade-up w-full max-w-md rounded-3xl bg-bg p-6 shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-fg">{t("pay.title")}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {PLAN_NAME[plan]} · {t(period === "year" ? "pay.year" : "pay.month")} ·{" "}
              <span className="font-semibold text-fg">{money(price)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-9 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {options && !payable ? <WaitlistForm plan={plan} period={period} /> : null}
          {payable && !user ? (
            <Link
              to="/login"
              search={{ mode: "signup", redirect: "/pricing" }}
              className={cn(method, "bg-brand justify-center text-white shadow-[var(--shadow-glow)]")}
            >
              {t("pay.signupFirst")}
            </Link>
          ) : null}
          {user && options?.crypto ? (
            <button
              type="button"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate("crypto")}
              className={cn(method, "bg-brand text-white shadow-[var(--shadow-glow)]")}
            >
              {checkout.isPending && checkout.variables === "crypto" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Bitcoin className="size-5" />
              )}
              <span className="flex-1">{t("pay.crypto")}</span>
              <span className="text-xs font-medium opacity-80">USDT · BTC · ETH</span>
            </button>
          ) : null}
          {user && options?.card ? (
            <button
              type="button"
              disabled={checkout.isPending || cardTooSmall}
              onClick={() => checkout.mutate("card")}
              className={cn(method, "bg-fg text-bg")}
            >
              {checkout.isPending && checkout.variables === "card" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <CreditCard className="size-5" />
              )}
              <span className="flex-1">{t("pay.card")}</span>
              <span className="text-xs font-medium opacity-80">Visa · Mastercard</span>
            </button>
          ) : null}
          {user && options?.card && cardTooSmall && cardMin !== null ? (
            <p className="px-1 text-xs leading-relaxed text-muted">{t("pay.cardMin", { min: money(cardMin) })}</p>
          ) : null}
          {user && options?.contact ? (
            <div className="rounded-xl bg-surface-2 p-4">
              <a
                href={contactHref(options.contact)}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  method,
                  "h-11 justify-center bg-surface text-fg shadow-[var(--shadow-border)]",
                )}
              >
                <MessageCircle className="size-5 text-primary" />
                {t("pay.contact")}
              </a>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {t("pay.contactHint", {
                  email: user?.primaryEmail ?? "",
                  plan: PLAN_NAME[plan],
                  price: money(price),
                })}
              </p>
            </div>
          ) : null}
          {!options ? <div className="skeleton h-12 w-full" /> : null}
          {user && payable ? <LegalConsent kind="pay" className="px-1" /> : null}
        </div>
        {failed ? (
          <p role="alert" className="mt-3 rounded-lg bg-short/10 px-3 py-2 text-sm text-short">
            {failure === "min_amount" && cardMin !== null
              ? t("pay.cardMin", { min: money(cardMin) })
              : t(failure === "unavailable" ? "pay.err.unavailable" : "pay.err.failed")}
          </p>
        ) : null}
        {checkout.isError ? <p className="mt-3 text-sm text-short">{t("pay.err.failed")}</p> : null}
        <ul className={cn("mt-5 flex flex-col gap-1.5 text-xs text-muted", !online && "hidden")}>
          <li className="flex gap-2">
            <ShieldCheck className="size-4 shrink-0 text-long" />
            {t("pay.noRenew")}
          </li>
          <li className="flex gap-2">
            <Zap className="size-4 shrink-0 text-wait" />
            {t("pay.instant")}
          </li>
        </ul>
      </div>
    </div>
  );
}

/** While online payment is off: leave an email, get told first and gifted Pro days at launch. */
function WaitlistForm({ plan, period }: { plan: PaidPlan; period: Period }) {
  const t = useT();
  const { user } = useCurrentUserState();
  const [email, setEmail] = useState(user?.primaryEmail ?? "");
  const join = useMutation({ mutationFn: () => joinWaitlist({ data: { email, plan, period } }) });
  if (join.data?.ok) {
    return (
      <p role="status" className="flex gap-2 rounded-2xl bg-long/12 p-4 text-sm leading-relaxed text-long">
        <Check className="mt-0.5 size-4 shrink-0" />
        {t("wait.done", { days: WAITLIST_GIFT_DAYS })}
      </p>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        join.mutate();
      }}
      className="rounded-2xl bg-primary/8 p-4 ring-1 ring-primary/20"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Gift className="size-4 text-primary" />
        {t("wait.title")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{t("wait.text", { days: WAITLIST_GIFT_DAYS })}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
          className="h-11 min-w-0 flex-1 rounded-xl bg-surface px-3 text-sm text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <button
          type="submit"
          disabled={join.isPending}
          className="bg-brand flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {join.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("wait.cta")}
        </button>
      </div>
      {join.data && !join.data.ok ? (
        <p role="alert" className="mt-2 text-xs text-short">
          {t(join.data.error === "email" ? "wait.err.email" : "wait.err.often")}
        </p>
      ) : null}
      {join.isError ? <p className="mt-2 text-xs text-short">{t("pay.err.failed")}</p> : null}
    </form>
  );
}

export function ReferralCard({ className, id }: { className?: string; id?: string }) {
  const t = useT();
  const billing = useBilling().data;
  const [copied, setCopied] = useState(false);
  if (!billing) return null;
  // Friends toward the next reward: 0, 1 or 2 of 3.
  const step = billing.referrals % REFERRAL_FRIENDS;
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/?ref=${billing.refCode}`;
  const copy = () => {
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <div
      id={id}
      className={cn("rounded-3xl bg-surface p-6 shadow-[var(--shadow-border)]", className)}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
          <Users className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-fg">{t("ref.title", REFERRAL)}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t("ref.text", REFERRAL)}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: REFERRAL_FRIENDS }, (_, i) => (
            <span key={i} className={cn("h-2 flex-1 rounded-full", i < step ? "bg-accent" : "bg-surface-2")} />
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-fg">
          {t("ref.progress", { n: step, friends: REFERRAL_FRIENDS, left: REFERRAL_FRIENDS - step, days: REFERRAL_BONUS_DAYS })}
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3 font-mono text-xs text-fg outline-none"
          aria-label={t("ref.link")}
        />
        <button
          type="button"
          onClick={copy}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {t(copied ? "ref.copied" : "ref.copy")}
        </button>
      </div>
      <p className="mt-3 text-xs text-faint">
        {t("ref.stats", {
          n: billing.referrals,
          days: billing.refBonusDays,
          cap: REFERRAL_BONUS_CAP,
        })}
      </p>
    </div>
  );
}

function Faq() {
  const t = useT();
  const [open, setOpen] = useState<number | null>(0);
  const items = [1, 2, 3, 4, 5, 6];
  return (
    <div className="mx-auto mt-16 max-w-3xl">
      <h2 className="text-center font-display text-2xl font-bold text-fg">{t("pfaq.title")}</h2>
      <div className="mt-6 flex flex-col gap-2">
        {items.map((i) => (
          <div key={i} className="rounded-2xl bg-surface shadow-[var(--shadow-border)]">
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold text-fg"
            >
              {t(`pfaq.q${i}` as MessageKey)}
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-faint transition-transform",
                  open === i && "rotate-180",
                )}
              />
            </button>
            {open === i ? (
              <p className="px-5 pb-4 text-sm leading-relaxed text-muted">
                {t(`pfaq.a${i}` as MessageKey, { ...REFERRAL, pct: YEAR_DISCOUNT_PCT })}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareTable() {
  const t = useT();
  const rows: { label: string; values: string[] }[] = [
    { label: t("credits.month", { n: "" }).trim(), values: ["free", "pro", "max"].map(p => String(MONTHLY_CREDITS[p as PlanId])) },
    { label: t("compare.market"), values: ["✓", "✓", "✓"] },
    ...AI_KINDS.map((kind) => ({
      label: t(`compare.${kind}` as MessageKey),
      values: (["free", "pro", "max"] as const).map((p) =>
        PLANS[p].limits[kind] > 0 ? String(PLANS[p].limits[kind]) : "—",
      ),
    })),
    { label: t("compare.alerts"), values: (["free", "pro", "max"] as const).map((p) => String(ALERT_LIMITS[p])) },
    { label: t("compare.alertsTech"), values: ["—", "✓", "✓"] },
    { label: t("compare.screener"), values: ["100", "300", "300"] },
    { label: t("compare.screenerPro"), values: ["—", "✓", "✓"] },
    { label: t("compare.portfolio"), values: ["✓", "✓", "✓"] },
    { label: t("compare.deep"), values: ["—", "—", "✓"] },
  ];
  return (
    <div className="mx-auto mt-16 max-w-4xl overflow-x-auto rounded-3xl bg-surface shadow-[var(--shadow-border)]">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-5 py-4 text-left font-display text-base font-bold text-fg">
              {t("compare.title")}
            </th>
            {(["free", "pro", "max"] as const).map((p) => (
              <th
                key={p}
                className={cn(
                  "px-4 py-4 text-center font-semibold",
                  p === "pro" ? "text-primary" : "text-fg",
                )}
              >
                {PLAN_NAME[p]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/60 last:border-0">
              <td className="px-5 py-3 text-muted">{row.label}</td>
              {row.values.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-4 py-3 text-center font-semibold tabular-nums",
                    v === "—" ? "text-faint" : v === "✓" ? "text-long" : "text-fg",
                  )}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-5 pb-2 text-sm text-muted">{t("credits.rules")}</p>
      <p className="px-5 pb-4 text-sm text-muted">{t("credits.trial", { n: TRIAL_CREDITS })}</p>
    </div>
  );
}

export function PricingPage({ paid, canceled }: { paid: boolean; canceled: boolean }) {
  const t = useT();
  const client = useQueryClient();
  const user = useMember();
  const billing = useBilling();
  const status = useSiteStatus();
  const [period, setPeriod] = useState<Period>("month");
  const [choosing, setChoosing] = useState<PaidPlan | null>(null);
  const current = billing.data
    ? billing.data.trial
      ? "free"
      : billing.data.plan
    : user
      ? null
      : null;

  useEffect(() => {
    if (!paid) return;
    const id = setInterval(() => void client.invalidateQueries({ queryKey: BILLING_KEY }), 5000);
    const stop = setTimeout(() => clearInterval(id), 120_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [paid, client]);

  const b = billing.data;
  return (
    <div className="pb-16">
      {paid ? (
        <p
          role="status"
          className="mx-auto mb-6 max-w-3xl rounded-2xl bg-long/12 px-5 py-4 text-sm font-medium text-long"
        >
          {b && b.plan !== "free" && !b.trial
            ? t("pricing.paidDone", { plan: PLAN_NAME[b.plan], days: daysLeft(b.until) })
            : t("pricing.paidWait")}
        </p>
      ) : null}
      {canceled ? (
        <p className="mx-auto mb-6 max-w-3xl rounded-2xl bg-surface-2 px-5 py-4 text-sm text-muted">
          {t("pricing.canceled")}
        </p>
      ) : null}

      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" />
          {t("pricing.badge")}
        </span>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t("pricing.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted">
          {t("pricing.subtitle", REFERRAL)}
        </p>
        {b?.trial ? (
          <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-wait/15 px-4 py-1.5 text-sm font-semibold text-fg">
            <Gift className="size-4 text-wait" />
            {t("trial.left", { n: daysLeft(b.until) })}
          </p>
        ) : b && b.plan !== "free" ? (
          <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-long/15 px-4 py-1.5 text-sm font-semibold text-fg">
            <Crown className="size-4 text-long" />
            {t("pricing.active", { plan: PLAN_NAME[b.plan], n: daysLeft(b.until) })}
          </p>
        ) : null}
        <div className="mt-6">
          <PeriodSwitch period={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-3">
        {(["free", "pro", "max"] as const).map((plan) => (
          <PlanCard
            key={plan}
            plan={plan}
            period={period}
            current={current}
            onChoose={setChoosing}
          />
        ))}
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl gap-3 text-sm sm:grid-cols-3">
        {(["trust.noRenew", "trust.crypto", "trust.trial"] as MessageKey[]).map((key) => (
          <p key={key} className="flex items-center justify-center gap-2 text-center text-muted">
            <ShieldCheck className="size-4 shrink-0 text-long" />
            {t(key, REFERRAL)}
          </p>
        ))}
      </div>

      {user ? <ReferralCard className="mx-auto mt-12 max-w-3xl scroll-mt-24" id="invite" /> : null}
      <CompareTable />
      <Faq />

      <div className="bg-brand mx-auto mt-16 max-w-4xl rounded-3xl p-8 text-center text-white shadow-[var(--shadow-glow)]">
        <h2 className="font-display text-2xl font-bold">{t("pricing.finalTitle")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/85">
          {t("pricing.finalText")}
        </p>
        {user ? (
          <button
            type="button"
            onClick={() => setChoosing("pro")}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-primary hover:opacity-95"
          >
            <Sparkles className="size-4" />
            {t("pricing.choose", { plan: "Pro" })}
          </button>
        ) : (
          <Link
            to="/login"
            search={{ mode: "signup", redirect: "/pricing" }}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-primary hover:opacity-95"
          >
            <Sparkles className="size-4" />
            {t("pricing.tryPro")}
          </Link>
        )}
      </div>

      {choosing ? (
        <PayDialog
          plan={choosing}
          period={period}
          options={status.data?.payments}
          onClose={() => setChoosing(null)}
        />
      ) : null}
    </div>
  );
}
