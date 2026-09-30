import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  DollarSign,
  Loader2,
  ListChecks,
  Megaphone,
  Send,
  Search,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  adminConnectDodo,
  adminConnectTelegram,
  adminPostChannelNow,
  adminSetChannel,
  adminFindMember,
  adminGrantWaitlist,
  adminCheckPayment,
  adminSetPlan,
  generateMarketing,
  getAdminOverview,
  getDodoStatus,
  getTelegramStatus,
  getWaitlist,
  MARKETING_CHANNELS,
  MARKETING_GOALS,
  type MarketingChannel,
  type MarketingGoal,
  type MemberInfo,
} from "@/lib/admin";
import { formatDate, useT, type MessageKey } from "@/lib/i18n";
import { AI_KINDS, PLAN_LABEL, WAITLIST_GIFT_DAYS, type PlanId } from "@/lib/plans";
import { useSettings } from "@/lib/settings-store";
import { daysLeft } from "@/lib/use-billing";
import { cn, stripMd } from "@/lib/utils";
import { AiFailure } from "@/components/billing/upsell";
import { COUNTRIES } from "@/lib/lang";
import { EXCHANGE_INFO } from "@/lib/exchanges";
import type { ClickStats } from "@/lib/exchange-clicks.server";

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
            <option value="max">Whale</option>
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

/** The Telegram bot for alerts: one click points it at this site; the cron address is shown for cron-job.org. */
function TelegramConnect() {
  const t = useT();
  const client = useQueryClient();
  const status = useQuery({ queryKey: ["admin-telegram"], queryFn: () => getTelegramStatus(), staleTime: 30_000 });
  const connect = useMutation({
    mutationFn: () => adminConnectTelegram(),
    onSuccess: (res) => {
      if (res.ok) client.setQueryData(["admin-telegram"], res.status);
    },
  });
  const [copied, setCopied] = useState(false);
  const data = status.data;
  const connected = Boolean(data?.bot && data.webhookUrl);
  const failure = connect.data && !connect.data.ok ? connect.data : null;
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
            <Send className="size-5 text-primary" />
            {t("admin.tg.title")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {!data ? "…" : !data.hasToken ? t("admin.tg.noKey") : connected ? t("admin.tg.connected", { bot: data.bot ?? "" }) : t("admin.tg.ready")}
          </p>
        </div>
        {data?.hasToken ? (
          <button
            type="button"
            disabled={connect.isPending}
            onClick={() => connect.mutate()}
            className={cn("flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50", connected ? "bg-surface-2 text-fg" : "bg-brand text-white")}
          >
            {connect.isPending ? <Loader2 className="size-4 animate-spin" /> : connected ? <CheckCircle2 className="size-4 text-long" /> : <Zap className="size-4" />}
            {t(connected ? "admin.tg.reconnect" : "admin.tg.connect")}
          </button>
        ) : null}
      </div>
      {connected && data?.autoChecks ? <p className="mt-3 text-sm text-long">{t("admin.tg.auto")}</p> : null}
      {connected && data?.cronUrl ? (
        <details className="mt-4 rounded-2xl bg-surface-2 p-4" open={!data.autoChecks}>
          <summary className="cursor-pointer text-sm font-semibold text-fg">{t(data.autoChecks ? "admin.tg.cronBackup" : "admin.tg.cronTitle")}</summary>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t("admin.tg.cronText")}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 font-mono text-xs text-fg">{data.cronUrl}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(data.cronUrl ?? "").then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-surface px-3 text-xs font-semibold text-fg shadow-[var(--shadow-border)]"
            >
              {copied ? <Check className="size-3.5 text-long" /> : <Copy className="size-3.5" />}
              {t(copied ? "admin.tg.copied" : "admin.tg.copy")}
            </button>
          </div>
        </details>
      ) : null}
      {connect.data?.ok ? <p role="status" className="mt-3 text-sm text-long">{t("admin.tg.done")}</p> : null}
      {failure ? (
        <p role="alert" className="mt-3 rounded-lg bg-short/10 px-3 py-2 text-sm text-short">
          {t(failure.error === "no_key" ? "admin.tg.noKey" : failure.error === "rejected" ? "admin.tg.err.rejected" : "admin.tg.err.failed")}
          {failure.detail ? <span className="mt-1 block font-mono text-xs break-all opacity-80">{failure.detail}</span> : null}
        </p>
      ) : null}
      {connect.isError ? <p className="mt-3 text-sm text-short">{t("admin.tg.err.failed")}</p> : null}
      {data?.hasToken ? <ChannelSettings channel={data.channel} last={data.channelLast} /> : null}
    </section>
  );
}

/** The owner's Telegram channel: the bot posts a market review there every morning. */
function ChannelSettings({ channel, last }: { channel: string | null; last: string | null }) {
  const t = useT();
  const client = useQueryClient();
  const [value, setValue] = useState(channel ?? "");
  const save = useMutation({
    mutationFn: () => adminSetChannel({ data: { channel: value } }),
    onSuccess: (res) => {
      if (res.ok) client.setQueryData(["admin-telegram"], res.status);
    },
  });
  const post = useMutation({
    mutationFn: () => adminPostChannelNow(),
    onSuccess: (res) => {
      if (res.status) client.setQueryData(["admin-telegram"], res.status);
    },
  });
  const saveError = save.data && !save.data.ok ? save.data : null;
  return (
    <div className="mt-4 rounded-2xl bg-surface-2 p-4">
      <p className="text-sm font-semibold text-fg">{t("admin.ch.title")}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{t("admin.ch.text")}</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="@my_channel"
          aria-label={t("admin.ch.title")}
          className="h-10 min-w-0 flex-1 rounded-xl bg-surface px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <button type="submit" disabled={save.isPending} className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-50">
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("admin.ch.save")}
        </button>
      </form>
      {channel ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-xs text-long">{t("admin.ch.on", { channel, last: last ?? "—" })}</p>
          <button type="button" disabled={post.isPending} onClick={() => post.mutate()} className="flex h-8 items-center gap-1.5 rounded-lg bg-surface px-3 text-xs font-semibold text-fg shadow-[var(--shadow-border)] disabled:opacity-50">
            {post.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            {t("admin.ch.postNow")}
          </button>
        </div>
      ) : null}
      {save.data?.ok ? <p role="status" className="mt-2 text-xs text-long">{t(value.trim() ? "admin.ch.saved" : "admin.ch.off")}</p> : null}
      {saveError ? (
        <p role="alert" className="mt-2 text-xs text-short">
          {t(saveError.error === "bad_name" ? "admin.ch.err.name" : saveError.error === "not_found" ? "admin.ch.err.notFound" : saveError.error === "not_admin" ? "admin.ch.err.notAdmin" : "admin.tg.noKey")}
        </p>
      ) : null}
      {post.data ? (
        <p role="status" className={cn("mt-2 text-xs", post.data.ok ? "text-long" : "text-short")}>
          {t(post.data.ok ? "admin.ch.posted" : post.data.result === "no_data" ? "admin.ch.err.noData" : "admin.ch.err.post")}
          {post.data.detail ? <span className="mt-1 block font-mono break-all opacity-80">{post.data.detail}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

/** Card payments through Dodo Payments: with DODO_API_KEY set, one click creates the product and webhook. */
function DodoConnect() {
  const t = useT();
  const client = useQueryClient();
  const status = useQuery({ queryKey: ["admin-dodo"], queryFn: () => getDodoStatus(), staleTime: 30_000 });
  const connect = useMutation({
    mutationFn: () => adminConnectDodo(),
    onSuccess: (res) => {
      if (res.ok) {
        client.setQueryData(["admin-dodo"], res.status);
        void client.invalidateQueries({ queryKey: ["site-status"] });
      }
    },
  });
  const data = status.data;
  const failure = connect.data && !connect.data.ok ? connect.data.error : null;
  const mode = data ? t(data.mode === "test" ? "admin.dodo.modeTest" : "admin.dodo.modeLive") : "";
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
            <CreditCard className="size-5 text-primary" />
            {t("admin.dodo.title")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {!data
              ? "…"
              : !data.hasKey
                ? t("admin.dodo.noKey")
                : data.connected
                  ? t("admin.dodo.connected", { mode })
                  : t("admin.dodo.ready", { mode })}
          </p>
          {data?.connected && data.webhookUrl ? <p className="mt-1 truncate font-mono text-xs text-faint">{data.webhookUrl}</p> : null}
        </div>
        {data?.hasKey ? (
          <button
            type="button"
            disabled={connect.isPending}
            onClick={() => connect.mutate()}
            className={cn(
              "flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50",
              data.connected ? "bg-surface-2 text-fg" : "bg-brand text-white",
            )}
          >
            {connect.isPending ? <Loader2 className="size-4 animate-spin" /> : data.connected ? <CheckCircle2 className="size-4 text-long" /> : <Zap className="size-4" />}
            {t(data.connected ? "admin.dodo.reconnect" : "admin.dodo.connect")}
          </button>
        ) : null}
      </div>
      {connect.data?.ok ? (
        <p role="status" className="mt-3 text-sm text-long">
          {t("admin.dodo.done")}
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="mt-3 rounded-lg bg-short/10 px-3 py-2 text-sm text-short">
          {t(failure === "no_key" ? "admin.dodo.noKey" : failure === "rejected" ? "admin.dodo.err.rejected" : "admin.dodo.err.failed")}
          {connect.data && !connect.data.ok && connect.data.detail ? (
            <span className="mt-1 block font-mono text-xs break-all opacity-80">{connect.data.detail}</span>
          ) : null}
        </p>
      ) : null}
      {connect.isError ? <p className="mt-3 text-sm text-short">{t("admin.dodo.err.failed")}</p> : null}
    </section>
  );
}

/** People who asked to buy while online payment was off — and the button that keeps the gift promise. */
function Waitlist() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const client = useQueryClient();
  const list = useQuery({ queryKey: ["admin-waitlist"], queryFn: () => getWaitlist(), staleTime: 30_000 });
  const grant = useMutation({
    mutationFn: () => adminGrantWaitlist(),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin-waitlist"] }),
  });
  const data = list.data;
  const waiting = data?.rows.filter((r) => !r.grantedAt && r.hasAccount).length ?? 0;
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
            <ListChecks className="size-5 text-primary" />
            {t("admin.waitlist", { n: data?.total ?? 0 })}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("admin.waitlistHint", { days: WAITLIST_GIFT_DAYS })}</p>
        </div>
        <button
          type="button"
          disabled={!waiting || grant.isPending}
          onClick={() => {
            if (window.confirm(t("admin.waitlistConfirm", { n: waiting, days: WAITLIST_GIFT_DAYS }))) grant.mutate();
          }}
          className="bg-brand flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {grant.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {t("admin.waitlistGrant", { n: waiting, days: WAITLIST_GIFT_DAYS })}
        </button>
      </div>
      {grant.data ? (
        <p role="status" className="mt-3 text-sm text-long">
          {t("admin.waitlistDone", { n: grant.data.granted, pending: grant.data.pending })}
        </p>
      ) : null}
      {data?.rows.length ? (
        <ul className="mt-4 flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-xl bg-surface-2">
          {data.rows.map((row) => (
            <li key={row.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-fg">{row.email}</span>
              <span className="text-xs text-muted">
                {PLAN_LABEL[(row.plan as PlanId) ?? "pro"] ?? row.plan} · {row.period === "year" ? "1y" : "1m"}
              </span>
              <span className="text-xs text-faint">{formatDate(lang, row.createdAt)}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  row.grantedAt ? "bg-long/15 text-long" : row.hasAccount ? "bg-wait/15 text-fg" : "bg-surface text-muted",
                )}
              >
                {t(row.grantedAt ? "admin.wl.granted" : row.hasAccount ? "admin.wl.ready" : "admin.wl.noAccount")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{list.isLoading ? "…" : t("admin.waitlistEmpty")}</p>
      )}
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
  const { stats, payments, setup, ai, clicks } = overview.data;
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
          value={`${ai.today} / ${ai.limit}`}
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
        <p className="mt-3 text-sm text-muted">
          {t("admin.aiModels", { free: ai.freeModel, paid: ai.paidModel })}
        </p>
        <p className="mt-1 text-xs text-faint">{t("admin.aiLimitHint", { n: ai.limit })}</p>
        <p className="mt-3 text-xs text-faint">{t("admin.setupHint")}</p>
      </section>

      <ExchangeClicks clicks={clicks} />

      <TelegramConnect />

      <DodoConnect />

      <div className="grid gap-6 lg:grid-cols-2">
        <Members />
        <Marketer />
      </div>

      <Waitlist />

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
                    {p.status === "pending" && p.provider === "dodo" ? <RecheckPayment id={p.id} /> : null}
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

/** "Check payment": asks Dodo whether a pending checkout was paid and turns the plan on if so. */
function RecheckPayment({ id }: { id: string }) {
  const t = useT();
  const client = useQueryClient();
  const check = useMutation({
    mutationFn: () => adminCheckPayment({ data: { id } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const result = check.data?.result;
  return (
    <span className="ml-2 inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => check.mutate()}
        disabled={check.isPending}
        className="rounded-lg bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
      >
        {t("admin.recheck")}
      </button>
      {result ? <span className="text-[11px] text-muted">{t(`admin.recheck.${result}` as MessageKey)}</span> : null}
    </span>
  );
}

function ExchangeClicks({ clicks }: { clicks: ClickStats }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const total = clicks.rows.reduce((sum, r) => sum + r.month, 0);
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-lg font-bold text-fg">{t("admin.clicks")}</h2>
      <p className="mt-1 text-xs text-muted">{t("admin.clicksHint")}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-xs text-faint">
            <tr>
              <th className="py-2 font-medium">{t("ex.page.colExchange")}</th>
              <th className="py-2 text-right font-medium">{t("admin.clicksToday")}</th>
              <th className="py-2 text-right font-medium">{t("admin.clicks7")}</th>
              <th className="py-2 text-right font-medium">{t("admin.clicks30")}</th>
            </tr>
          </thead>
          <tbody>
            {clicks.rows.map((r) => (
              <tr key={r.exchange} className="border-t border-border">
                <td className="py-2 font-semibold text-fg">{EXCHANGE_INFO[r.exchange].name}</td>
                <td className="py-2 text-right tabular-nums">{r.today}</td>
                <td className="py-2 text-right tabular-nums">{r.week}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{r.month}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total ? (
        <p className="mt-3 text-xs text-muted">
          {t("admin.clicksCountries")}{" "}
          {clicks.countries
            .map((c) => {
              const known = COUNTRIES.find((x) => x.id === c.country);
              return `${known ? `${known.flag} ${known[lang]}` : c.country} — ${c.count}`;
            })
            .join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
