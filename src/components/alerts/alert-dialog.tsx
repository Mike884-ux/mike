import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Crown, Loader2, Lock, Send, X } from "lucide-react";
import { ALERT_KINDS, FREE_KINDS, TECH_KINDS, type AlertKind } from "@/lib/alert-rules";
import { addAlert } from "@/lib/alerts";
import { usdPrice } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { TAPE_CRYPTOS } from "@/lib/markets";
import { ALERTS_KEY, useAlerts, useConnectTelegram } from "@/lib/use-alerts";
import { cn } from "@/lib/utils";

export type AlertTarget = { symbol: string; coinId: string | null; name: string; price: number | null };

const ERR: Record<string, MessageKey> = {
  pro: "alerts.err.pro",
  limit: "alerts.err.limit",
  bad_input: "alerts.err.value",
  unsupported: "alerts.err.unsupported",
};

function defaultValue(kind: AlertKind, price: number | null): string {
  if (kind === "price_above" || kind === "price_below") {
    if (!price) return "";
    const target = price * (kind === "price_above" ? 1.05 : 0.95);
    return String(Number(target.toPrecision(target >= 1 ? 6 : 4)));
  }
  if (kind === "change_24h") return "10";
  if (kind === "rsi_below") return "30";
  if (kind === "rsi_above") return "70";
  return "";
}

/** "Alert me" for one coin: pick what to watch; the message comes to Telegram. */
export function AlertDialog({ target, onClose }: { target: AlertTarget; onClose: () => void }) {
  const t = useT();
  const client = useQueryClient();
  const overview = useAlerts().data;
  const connect = useConnectTelegram();
  const pro = overview ? overview.plan !== "free" : false;
  const techOk = (TAPE_CRYPTOS as readonly string[]).includes(target.symbol);
  const kinds = ALERT_KINDS.filter((k) => techOk || !TECH_KINDS.includes(k));
  const [kind, setKind] = useState<AlertKind>("price_above");
  const [value, setValue] = useState(() => defaultValue("price_above", target.price));
  const [error, setError] = useState<MessageKey | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const save = useMutation({
    mutationFn: () => addAlert({ data: { symbol: target.symbol, coinId: target.coinId, kind, value: kind === "signal" ? null : value } }),
    onSuccess: (res) => {
      if (!res.ok) return setError(ERR[res.error] ?? "alerts.err.value");
      void client.invalidateQueries({ queryKey: ALERTS_KEY });
      setDone(true);
    },
    onError: () => setError("alerts.err.save"),
  });

  const locked = !pro && !FREE_KINDS.includes(kind);
  const pick = (k: AlertKind) => {
    setKind(k);
    setValue(defaultValue(k, target.price));
    setError(null);
  };
  const field = "h-11 w-full rounded-xl bg-surface-2 px-3 text-sm text-fg outline-none tabular-nums placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40";
  const linked = overview?.telegram.linked ?? false;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t("alerts.dialogTitle", { name: target.name })} onClick={onClose}>
      <div className="fade-up max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-bg p-5 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
              <Bell className="size-5 text-primary" />
              {t("alerts.dialogTitle", { name: target.name })}
            </h2>
            {target.price ? <p className="mt-0.5 text-xs text-muted">{t("alerts.now", { price: usdPrice(target.price) })}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid size-9 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-fg">
            <X className="size-5" />
          </button>
        </div>

        {done ? (
          <div className="mt-5">
            <p role="status" className="rounded-xl bg-long/12 px-4 py-3 text-sm font-medium text-long">
              {t(linked ? "alerts.added" : "alerts.addedNoTg")}
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setDone(false)} className="h-10 flex-1 rounded-xl bg-surface-2 text-sm font-semibold text-fg hover:bg-surface-3">
                {t("alerts.another")}
              </button>
              <Link to="/alerts" onClick={onClose} className="flex h-10 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-fg">
                {t("alerts.mine")}
              </Link>
            </div>
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (locked) return setError("alerts.err.pro");
              setError(null);
              save.mutate();
            }}
          >
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="sr-only">{t("alerts.kindLabel")}</legend>
              {kinds.map((k) => {
                const proOnly = !FREE_KINDS.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => pick(k)}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-1.5 rounded-xl px-3 py-2 text-left text-sm font-semibold ring-1 transition",
                      kind === k ? "bg-primary/10 text-fg ring-primary" : "bg-surface text-muted ring-border hover:text-fg",
                    )}
                  >
                    {t(`alerts.k.${k}` as MessageKey)}
                    {proOnly && !pro ? <Lock className="size-3.5 shrink-0 text-wait" /> : null}
                  </button>
                );
              })}
            </fieldset>
            {!techOk ? <p className="text-xs text-faint">{t("alerts.techOnlyTop")}</p> : null}

            {kind !== "signal" ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted">{t(`alerts.v.${kind}` as MessageKey)}</span>
                <input inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)} className={field} />
              </label>
            ) : (
              <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-muted">{t("alerts.signalHint")}</p>
            )}

            {locked ? (
              <p className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/8 px-3 py-2.5 text-sm text-fg ring-1 ring-primary/25">
                <Crown className="size-4 text-primary" />
                {t("alerts.err.pro")}
                <Link to="/pricing" onClick={onClose} className="font-semibold text-primary hover:underline">{t("scr.proCta")}</Link>
              </p>
            ) : null}
            {error && !locked ? (
              <p role="alert" className="rounded-lg bg-short/10 px-3 py-2 text-sm text-short">
                {t(error, { n: overview?.limit ?? 0 })}
              </p>
            ) : null}

            <button type="submit" disabled={save.isPending || locked} className="bg-brand mt-1 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50">
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
              {t("alerts.save")}
            </button>

            {overview && !linked ? (
              <div className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
                {t(overview.telegram.bot ? "alerts.needTg" : "alerts.tgSoon")}
                {overview.telegram.bot ? (
                  <button type="button" onClick={() => connect.mutate()} disabled={connect.isPending} className="mt-2 flex h-9 items-center gap-2 rounded-lg bg-[#229ED9] px-3 text-sm font-semibold text-white disabled:opacity-60">
                    {connect.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {t("alerts.connectTg")}
                  </button>
                ) : null}
              </div>
            ) : null}
            <p className="text-[11px] leading-relaxed text-faint">{t("alerts.note")}</p>
          </form>
        )}
      </div>
    </div>
  );
}
