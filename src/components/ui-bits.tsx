import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";
import { LANGS, type Lang } from "@/lib/lang";
import { useSettings } from "@/lib/settings-store";
import type { Signal } from "@/lib/types";
import { cn } from "@/lib/utils";

export const SIGNAL_BG: Record<Signal, string> = {
  LONG: "bg-long/15 text-long",
  SHORT: "bg-short/15 text-short",
  WAIT: "bg-wait/15 text-wait",
};

export function SignalBadge({ signal, className }: { signal: Signal; className?: string }) {
  const t = useT();
  const Icon = signal === "LONG" ? ArrowUp : signal === "SHORT" ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
        SIGNAL_BG[signal],
        className,
      )}
    >
      <Icon className="size-3" />
      {t(`signal.${signal}` as MessageKey)}
    </span>
  );
}

/** −100…+100 score as a centered bar: green to the right, red to the left. */
export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.min(100, Math.abs(score));
  return (
    <div className={cn("flex items-center gap-2", className)} title={`${score > 0 ? "+" : ""}${score}`}>
      <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
        <span className="absolute top-0 left-1/2 h-full w-px bg-border" />
        <span
          className={cn("absolute top-0 h-full rounded-full", score >= 0 ? "left-1/2 bg-long" : "right-1/2 bg-short")}
          style={{ width: `${pct / 2}%` }}
        />
      </div>
      <span className={cn("w-8 font-mono text-[11px] tabular-nums", score > 0 ? "text-long" : score < 0 ? "text-short" : "text-faint")}>
        {score > 0 ? "+" : ""}
        {score}
      </span>
    </div>
  );
}

const AI_ERROR_KEYS = new Set(["no_key", "bad_key", "no_credit", "gateway_setup", "rate_limited", "refused", "unavailable", "too_often", "no_data", "empty"]);

/** Message key for an AI failure reason coming back from the server. */
export function aiErrorKey(reason: string | undefined): MessageKey {
  return (AI_ERROR_KEYS.has(reason ?? "") ? `aiErr.${reason}` : "aiErr.unavailable") as MessageKey;
}

export function LangSwitcher({ onChange, className }: { onChange?: (lang: Lang) => void; className?: string }) {
  const lang = useSettings((s) => s.lang);
  const setLang = useSettings((s) => s.setLang);
  return (
    <div className={cn("flex gap-1 rounded-full bg-surface-2 p-1", className)} role="radiogroup" aria-label="Language">
      {LANGS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={lang === item.id}
          aria-label={item.label}
          title={item.label}
          onClick={() => {
            setLang(item.id);
            onChange?.(item.id);
          }}
          className={cn(
            "h-7 rounded-full px-2.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
            lang === item.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
          )}
        >
          {item.id.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-xl bg-surface shadow-[var(--shadow-border)]", className)}>{children}</div>;
}
