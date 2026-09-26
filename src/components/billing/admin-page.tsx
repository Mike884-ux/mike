import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  Loader2,
  Megaphone,
  Search,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  adminFindMember,
  adminSetPlan,
  generateMarketing,
  getAdminOverview,
  MARKETING_CHANNELS,
  MARKETING_GOALS,
  type MarketingChannel,
  type MarketingGoal,
  type MemberInfo,
} from "@/lib/admin";
import { formatDate, useT, type MessageKey } from "@/lib/i18n";
import { AI_KINDS } from "@/lib/plans";
import { useSettings } from "@/lib/settings-store";
import { daysLeft } from "@/lib/use-billing";
import { cn, stripMd } from "@/lib/utils";
import { AiFailure } from "@/components/billing/upsell";

function Tile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-bold text-fg tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

function MemberCard({ member }: { member: MemberInfo }) {
  const t = useT();
  return (
    <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
      <p className="font-semibold text-fg">
        {member.email} <span className="font-normal text-muted">· {member.name}</span>
      </p>
      <p className="mt-1 text-muted">
        {t("admin.plan")}: <span className="font-semibold text-fg uppercase">{member.plan}</span>
        {member.trial ? ` (${t("admin.trial")})` : ""}
        {member.until ? ` · ${t("admin.daysLeft", { n: daysLeft(member.until) })}` : ""} ·{" "}
        {t("admin.referrals")}: {member.referrals}
      </p>
      <p className="mt-1 text-xs text-faint">
        {t("admin.usedToday")}: {AI_KINDS.map((k) => `${k} ${member.used[k]}`).join(" · ")}
      </p>
    </div>
  );
}

function Members() {
  const t = useT();
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"pro" | "max" | "free">("pro");
  const [days, setDays] = useState("30");
  const find = useMutation({ mutationFn: () => adminFindMember({ data: { email } }) });
  const grant = useMutation({
    mutationFn: () => adminSetPlan({ data: { email, plan, days: Number(days) } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const member = grant.data?.ok ? grant.data.member : find.data?.member;
  const field =
    "h-10 rounded-xl bg-surface-2 px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
        <UserPlus className="size-5 text-primary" />
        {t("admin.members")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("admin.membersHint")}</p>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          find.mutate();
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className={cn(field, "min-w-56 flex-1")}
        />
        <button
          type="submit"
          disabled={find.isPending}
          className="flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-semibold text-fg hover:bg-surface-3"
        >
          {find.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {t("admin.find")}
        </button>
      </form>
      {find.data && !find.data.member ? (
        <p className="mt-3 text-sm text-short">{t("admin.notFound")}</p>
      ) : null}
      {member ? <MemberCard member={member} /> : null}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("admin.plan")}
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as typeof plan)}
            className={field}
          >
            <option value="pro">Pro</option>
            <option value="max">Max</option>
            <option value="free">Free ({t("admin.revoke")})</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("admin.days")}
          <input
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            disabled={plan === "free"}
            className={cn(field, "w-24")}
          />
        </label>
        <button
          type="button"
          disabled={!email || grant.isPending}
          onClick={() => grant.mutate()}
          className="bg-brand flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {grant.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {t("admin.apply")}
        </button>
      </div>
      {grant.data && !grant.data.ok ? (
        <p className="mt-2 text-sm text-short">
          {t(grant.data.error === "not_found" ? "admin.notFound" : "admin.badInput")}
        </p>
      ) : null}
      {grant.data?.ok ? <p className="mt-2 text-sm text-long">{t("admin.applied")}</p> : null}
    </section>
  );
}

const CHANNEL_LABEL: Record<MarketingChannel, string> = {
  telegram: "Telegram",
  instagram: "Instagram",
  tiktok: "TikTok / Reels",
  x: "X (Twitter)",
};

function Marketer() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const [channel, setChannel] = useState<MarketingChannel>("telegram");
  const [goal, setGoal] = useState<MarketingGoal>("signup");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const gen = useMutation({
    mutationFn: () => generateMarketing({ data: { channel, goal, lang, notes } }),
  });
  const text = gen.data?.ok ? stripMd(gen.data.text) : "";
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
        <Megaphone className="size-5 text-primary" />
        {t("admin.marketer")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("admin.marketerHint")}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {MARKETING_CHANNELS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={channel === c}
            onClick={() => setChannel(c)}
            className={cn(
              "h-9 rounded-full px-3.5 text-sm font-semibold",
              channel === c
                ? "bg-primary text-primary-fg"
                : "bg-surface-2 text-muted hover:text-fg",
            )}
          >
            {CHANNEL_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MARKETING_GOALS.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={goal === g}
            onClick={() => setGoal(g)}
            className={cn(
              "h-9 rounded-full px-3.5 text-sm font-semibold",
              goal === g ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:text-fg",
            )}
          >
            {t(`admin.goal.${g}` as MessageKey)}
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={t("admin.notes")}
        className="mt-3 w-full resize-none rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      <button
        type="button"
        onClick={() => gen.mutate()}
        disabled={gen.isPending}
        className="bg-brand mt-2 flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-[var(--shadow-glow)] disabled:opacity-60"
      >
        {gen.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {t(gen.data?.ok ? "admin.regenerate" : "admin.generate")}
      </button>
      {gen.isPending ? <p className="mt-3 shimmer-text text-sm">{t("admin.writing")}</p> : null}
      {gen.data && !gen.data.ok && !gen.isPending ? (
        <AiFailure reason={gen.data.reason} className="mt-3" />
      ) : null}
      {gen.isError ? <AiFailure reason="unavailable" className="mt-3" /> : null}
      {text && !gen.isPending ? (
        <div className="fade-up mt-4 rounded-2xl bg-surface-2 p-4">
          <p className="text-sm leading-relaxed whitespace-pre-line text-fg">{text}</p>
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard?.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              })
            }
            className="mt-3 flex h-9 items-center gap-2 rounded-lg bg-surface px-3 text-sm font-semibold text-fg shadow-[var(--shadow-border)]"
          >
            {copied ? <Check className="size-4 text-long" /> : <Copy className="size-4" />}
            {t(copied ? "ref.copied" : "ref.copy")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function AdminPage() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    retry: false,
    staleTime: 30_000,
  });

  if (overview.isLoading) return <div className="skeleton h-64 w-full" />;
  if (overview.isError || !overview.data) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl bg-surface p-8 text-center shadow-[var(--shadow-border)]">
        <ShieldAlert className="mx-auto size-8 text-wait" />
        <h1 className="mt-3 font-display text-xl font-bold text-fg">{t("admin.denied")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("admin.deniedText")}</p>
      </div>
    );
  }
  const { stats, payments, setup } = overview.data;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">{t("admin.title")}</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={<Users className="size-3.5" />}
          label={t("admin.users")}
          value={String(stats.users)}
          hint={t("admin.newUsers", { d: stats.usersToday, w: stats.users7d })}
        />
        <Tile
          icon={<Zap className="size-3.5" />}
          label={t("admin.paying")}
          value={String(stats.paidActive)}
          hint={t("admin.trials", { n: stats.trialActive })}
        />
        <Tile
          icon={<DollarSign className="size-3.5" />}
          label={t("admin.revenue30")}
          value={`$${stats.revenue30d.toFixed(0)}`}
          hint={t("admin.revenueTotal", { n: stats.revenueTotal.toFixed(0) })}
        />
        <Tile
          icon={<Sparkles className="size-3.5" />}
          label={t("admin.aiToday")}
          value={String(stats.aiToday)}
          hint={t("admin.referred", { n: stats.referred })}
        />
      </div>

      <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-bold text-fg">{t("admin.setup")}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {setup.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              {item.ok ? (
                <CheckCircle2 className="size-4 text-long" />
              ) : (
                <XCircle className="size-4 text-faint" />
              )}
              <span className={cn("font-mono text-xs", item.ok ? "text-fg" : "text-muted")}>
                {item.key}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-faint">{t("admin.setupHint")}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Members />
        <Marketer />
      </div>

      <section className="overflow-x-auto rounded-3xl bg-surface shadow-[var(--shadow-border)]">
        <h2 className="px-5 pt-5 font-display text-lg font-bold text-fg">{t("admin.payments")}</h2>
        {payments.length ? (
          <table className="mt-3 w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-faint">
                <th className="px-5 py-2.5 font-normal">{t("wallet.tx.date")}</th>
                <th className="px-3 py-2.5 font-normal">Email</th>
                <th className="px-3 py-2.5 font-normal">{t("admin.plan")}</th>
                <th className="px-3 py-2.5 text-right font-normal">$</th>
                <th className="px-3 py-2.5 font-normal">{t("admin.provider")}</th>
                <th className="px-5 py-2.5 font-normal">{t("admin.status")}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-2.5 text-xs whitespace-nowrap text-muted">
                    {formatDate(lang, p.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 text-fg">{p.email}</td>
                  <td className="px-3 py-2.5 text-fg uppercase">
                    {p.plan} · {p.period === "year" ? "1y" : "1m"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-fg tabular-nums">
                    {p.amount}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{p.provider}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        p.status === "paid"
                          ? "bg-long/15 text-long"
                          : p.status === "failed"
                            ? "bg-short/15 text-short"
                            : "bg-surface-2 text-muted",
                      )}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-5 text-sm text-muted">{t("admin.noPayments")}</p>
        )}
      </section>
    </div>
  );
}
