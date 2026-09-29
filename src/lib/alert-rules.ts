/**
 * Price and signal alerts: kinds, plan rules and when an alert fires. Pure —
 * shared by the site, the checker and the tests.
 */
import type { PlanId } from "./plans.ts";
import type { Signal } from "./types.ts";

export const ALERT_KINDS = ["price_above", "price_below", "change_24h", "signal", "rsi_below", "rsi_above"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

/** Free members get price alerts; the rest is Pro. */
export const FREE_KINDS: readonly AlertKind[] = ["price_above", "price_below"];
/**
 * Retired: indicator "signal change" alerts. Old rows still read, but none are
 * created or checked any more — the site shows the AI's call instead.
 */
export const RETIRED_KINDS: readonly AlertKind[] = ["signal"];
/** What a member can pick for a new alert. */
export const SELECTABLE_KINDS: readonly AlertKind[] = ALERT_KINDS.filter((k) => !RETIRED_KINDS.includes(k));
/** Kinds that need the technical scan, which covers the large coins only. */
export const TECH_KINDS: readonly AlertKind[] = ["signal", "rsi_below", "rsi_above"];

export type Alert = {
  id: string;
  symbol: string;
  coinId: string | null;
  kind: AlertKind;
  value: number | null;
  state: string | null;
  active: boolean;
  firedCount: number;
  lastFiredAt: number | null;
  createdAt: number;
};

export type Quote = { price: number; change24h: number | null };
export type Tech = { signal: Signal; rsi: number };

/** Once in the zone, RSI must leave it by this much before the alert can fire again. */
export const RSI_REARM = 3;
/** A big move re-arms once the day's change falls back under this share of the threshold. */
export const CHANGE_REARM = 0.8;

/** A kind for a new alert; retired kinds are refused. */
export function asAlertKind(value: unknown): AlertKind | null {
  return SELECTABLE_KINDS.find((k) => k === value) ?? null;
}

export function kindAllowed(plan: PlanId, kind: AlertKind): boolean {
  return plan !== "free" || FREE_KINDS.includes(kind);
}

/** The threshold for a kind, or null when it is out of range. Signal alerts take none. */
export function alertValue(kind: AlertKind, raw: unknown): number | null | undefined {
  if (kind === "signal") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  if (kind === "price_above" || kind === "price_below") return n > 0 && n < 1e12 ? n : undefined;
  if (kind === "change_24h") return n >= 1 && n <= 100 ? n : undefined;
  return n >= 1 && n <= 99 ? n : undefined;
}

export type Verdict = { fire: boolean; state: string | null; deactivate: boolean };

/**
 * What to do with an alert given fresh data. `null` means there is no data
 * for it this round — leave it as it is.
 */
export function evaluate(alert: Pick<Alert, "kind" | "value" | "state">, quote: Quote | null, tech: Tech | null): Verdict | null {
  const value = alert.value ?? 0;
  switch (alert.kind) {
    case "price_above":
      if (!quote) return null;
      return quote.price >= value ? { fire: true, state: null, deactivate: true } : { fire: false, state: null, deactivate: false };
    case "price_below":
      if (!quote) return null;
      return quote.price <= value ? { fire: true, state: null, deactivate: true } : { fire: false, state: null, deactivate: false };
    case "change_24h": {
      if (!quote || quote.change24h === null) return null;
      const move = Math.abs(quote.change24h);
      const hit = alert.state === "hit" ? move >= value * CHANGE_REARM : move >= value;
      return { fire: hit && alert.state !== "hit", state: hit ? "hit" : "clear", deactivate: false };
    }
    case "signal":
      if (!tech) return null;
      // The first look only remembers the signal: a change is what's worth a message.
      return {
        fire: alert.state !== null && tech.signal !== alert.state && tech.signal !== "WAIT",
        state: tech.signal,
        deactivate: false,
      };
    case "rsi_below":
    case "rsi_above": {
      if (!tech) return null;
      const below = alert.kind === "rsi_below";
      const inside = below ? tech.rsi <= value : tech.rsi >= value;
      const stays = below ? tech.rsi <= value + RSI_REARM : tech.rsi >= value - RSI_REARM;
      const zone = alert.state === "in" ? stays : inside;
      return { fire: zone && alert.state !== "in", state: zone ? "in" : "out", deactivate: false };
    }
  }
}
