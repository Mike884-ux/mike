import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, BellOff, CheckCircle2, Crown, Loader2, Plus, Send, Trash2 } from "lucide-react";
import type { Alert } from "@/lib/alert-rules";
import { usdPrice } from "@/lib/format";
import { formatDate, useT, type MessageKey } from "@/lib/i18n";
import { PLAN_LABEL } from "@/lib/plans";
import { useSettings } from "@/lib/settings-store";
import { useFavorites } from "@/lib/use-account";
import { useAlerts, useConnectTelegram, useDisconnectTelegram, useRemoveAlert } from "@/lib/use-alerts";
import { useWatchlist } from "@/lib/use-market";
import { cn } from "@/lib/utils";
import { AlertDialog, type AlertTarget } from "@/components/alerts/alert-dialog";
import { CoinLogo } from "@/components/market/bits";
import { Container } from "@/components/site/shell";

const QUICK = ["BTC", "ETH", "SOL", "BNB", "XRP", "TON", "DOGE"];

function describe(t: ReturnType<typeof useT>, alert: Alert): string {
  const v = alert.kind === "price_above" || alert.kind === "price_below" ? usdPrice(alert.value) : String(alert.value ?? "");
  return t(`alerts.d.${alert.kind}` as MessageKey, { v });
}

function TelegramCard() {
  const t = useT();
  const data = useAlerts().data;
  const connect = useConnectTelegram();
  const disconnect = useDisconnectTelegram();
  if (!data) return <div className="skeleton h-28 w-full rounded-2xl" />;
  const { linked, username, bot } = data.telegram;
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#229ED9] text-white">
            <Send className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-fg">{t("alerts.tgTitle")}</p>
            <p className="text-sm text-muted">
              {linked ? (
                <span className="inline-flex items-center gap-1.5 text-long">
                  <CheckCircle2 className="size-4" />
                  {t("alerts.tgLinked", { user: username ? `@${username}` : "" })}
                </span>
              ) : bot ? (
                t("alerts.tgNotLinked")
              ) : (
                t("alerts.tgSoon")
              )}
            </p>
          </div>
        </div>
        {bot ? (
          linked ? (
            <button type="button" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-semibold text-fg hover:bg-surface-3 disabled:opacity-60">
              <BellOff className="size-4" />
              {t("alerts.disconnectTg")}
            </button>
          ) : (
            <button type="button" onClick={() => connect.mutate()} disabled={connect.isPending} className="flex h-10 items-center gap-2 rounded-xl bg-[#229ED9] px-4 text-sm font-semibold text-white disabled:opacity-60">
              {connect.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {t("alerts.connectTg")}
            </button>
          )
        ) : null}
      </div>
      {!linked && bot ? <p className="mt-3 text-xs text-faint">{t("alerts.tgHow", { bot: `@${bot}` })}</p> : null}
      {linked && bot ? <p className="mt-3 text-xs text-faint">{t("alerts.tgBot", { bot: `@${bot}` })}</p> : null}
    </section>
  );
}

export function AlertsPage() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const query = useAlerts();
  const remove = useRemoveAlert();
  const { favorites } = useFavorites();
  const quickSymbols = [...new Set([...favorites.slice(0, 5), ...QUICK])].slice(0, 10);
  const quick = useWatchlist(quickSymbols);
  const [target, setTarget] = useState<AlertTarget | null>(null);
  const data = query.data;
  const active = data?.alerts.filter((a) => a.active) ?? [];
  const done = data?.alerts.filter((a) => !a.active) ?? [];

  return (
    <Container className="py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-fg sm:text-[28px]">
            <Bell className="size-6 text-primary" />
            {t("alerts.title")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">{t("alerts.subtitle")}</p>
        </div>
        {data ? (
          <p className="text-sm text-muted">
            {t("alerts.used", { n: active.length, total: data.limit, plan: PLAN_LABEL[data.plan] })}
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="flex min-w-0 flex-col gap-5">
          <TelegramCard />

          <section className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-lg font-bold text-fg">{t("alerts.add")}</h2>
            <p className="mt-1 text-sm text-muted">{t("alerts.addHint")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(quick.data?.coins ?? []).map((coin) => (
                <button
                  key={coin.id}
                  type="button"
                  onClick={() => setTarget({ symbol: coin.symbol, coinId: coin.id, name: coin.name, price: coin.price })}
                  className="flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-3 text-sm font-semibold text-fg hover:bg-surface-3"
                >
                  <CoinLogo src={coin.image} symbol={coin.symbol} className="size-5" />
                  {coin.symbol}
                  <Plus className="size-3.5 text-faint" />
                </button>
              ))}
              {quick.isLoading ? <div className="skeleton h-10 w-64 rounded-xl" /> : null}
            </div>
          </section>

          <section className="rounded-2xl bg-surface shadow-[var(--shadow-border)]">
            <h2 className="px-5 pt-5 font-display text-lg font-bold text-fg">{t("alerts.active")}</h2>
            {query.isLoading ? (
              <div className="skeleton m-5 h-24 rounded-xl" />
            ) : active.length ? (
              <ul className="mt-2">
                {active.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} label={describe(t, alert)} onDelete={() => remove.mutate(alert.id)} deleting={remove.isPending && remove.variables === alert.id} />
                ))}
              </ul>
            ) : (
              <p className="px-5 pt-2 pb-5 text-sm text-muted">{t("alerts.empty")}</p>
            )}
          </section>

          {done.length ? (
            <section className="rounded-2xl bg-surface shadow-[var(--shadow-border)]">
              <h2 className="px-5 pt-5 font-display text-lg font-bold text-fg">{t("alerts.fired")}</h2>
              <ul className="mt-2">
                {done.slice(0, 20).map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    label={describe(t, alert)}
                    extra={alert.lastFiredAt ? t("alerts.firedAt", { date: formatDate(lang, alert.lastFiredAt) }) : undefined}
                    onDelete={() => remove.mutate(alert.id)}
                    deleting={remove.isPending && remove.variables === alert.id}
                    muted
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl bg-surface-2 p-5">
            <h2 className="font-semibold text-fg">{t("alerts.howTitle")}</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
              <li>{t("alerts.how1")}</li>
              <li>{t("alerts.how2")}</li>
              <li>{t("alerts.how3")}</li>
            </ol>
          </div>
          {data && data.plan === "free" ? (
            <div className="rounded-2xl bg-primary/8 p-5 ring-1 ring-primary/25">
              <p className="flex items-center gap-2 font-semibold text-fg">
                <Crown className="size-4 text-primary" />
                {t("alerts.proTitle")}
              </p>
              <p className="mt-1 text-sm text-muted">{t("alerts.proText")}</p>
              <Link to="/pricing" className="bg-brand mt-3 inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-white">{t("scr.proCta")}</Link>
            </div>
          ) : null}
          <Link to="/screener" className="rounded-2xl bg-surface p-5 text-sm font-semibold text-primary shadow-[var(--shadow-border)] hover:bg-surface-2">
            {t("alerts.toScreener")} →
          </Link>
        </aside>
      </div>

      {target ? <AlertDialog target={target} onClose={() => setTarget(null)} /> : null}
    </Container>
  );
}

function AlertRow({ alert, label, extra, onDelete, deleting, muted }: { alert: Alert; label: string; extra?: string; onDelete: () => void; deleting: boolean; muted?: boolean }) {
  const t = useT();
  return (
    <li className={cn("flex items-center gap-3 border-t border-border px-5 py-3", muted && "opacity-70")}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 font-mono text-[11px] font-bold text-primary">{alert.symbol.slice(0, 4)}</span>
      <div className="min-w-0 flex-1">
        {alert.coinId ? (
          <Link to="/coins/$id" params={{ id: alert.coinId }} className="text-sm font-semibold text-fg hover:underline">{alert.symbol}</Link>
        ) : (
          <span className="text-sm font-semibold text-fg">{alert.symbol}</span>
        )}
        <p className="truncate text-xs text-muted">{label}{extra ? ` · ${extra}` : ""}</p>
      </div>
      <button type="button" onClick={onDelete} disabled={deleting} aria-label={t("alerts.delete")} className="grid size-9 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-short disabled:opacity-50">
        {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
    </li>
  );
}
