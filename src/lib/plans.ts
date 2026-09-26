/** Subscription plans — shared by server and client. Prices in US dollars. */

export const PLAN_IDS = ["free", "pro", "max"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type PaidPlan = Exclude<PlanId, "free">;
export const PERIODS = ["month", "year"] as const;
export type Period = (typeof PERIODS)[number];

/** What costs AI money, counted per day (UTC). */
export const AI_KINDS = ["analysis", "chat", "advice", "strategy"] as const;
export type AiKind = (typeof AI_KINDS)[number];

export type PlanSpec = {
  id: PlanId;
  /** Monthly price; the yearly price is 12 months with the yearly discount. */
  month: number;
  year: number;
  limits: Record<AiKind, number>;
};

export const YEAR_DISCOUNT_PCT = 20;

const yearly = (month: number) => Math.round(month * 12 * (1 - YEAR_DISCOUNT_PCT / 100));

export const PLANS: Record<PlanId, PlanSpec> = {
  free: {
    id: "free",
    month: 0,
    year: 0,
    limits: { analysis: 3, chat: 10, advice: 1, strategy: 0 },
  },
  pro: {
    id: "pro",
    month: 9,
    year: yearly(9),
    limits: { analysis: 40, chat: 150, advice: 10, strategy: 5 },
  },
  max: {
    id: "max",
    month: 24,
    year: yearly(24),
    limits: { analysis: 150, chat: 500, advice: 40, strategy: 20 },
  },
};

export const PERIOD_DAYS: Record<Period, number> = { month: 30, year: 365 };

/** Free Pro days for a new account, and for someone who joins by a friend's link. */
export const TRIAL_DAYS = 3;
export const REFERRED_TRIAL_DAYS = 7;
/** Pro days the inviter earns per friend, up to the cap. */
export const REFERRAL_BONUS_DAYS = 3;
export const REFERRAL_BONUS_CAP = 30;

export function priceOf(plan: PaidPlan, period: Period): number {
  return period === "year" ? PLANS[plan].year : PLANS[plan].month;
}

export function asPaidPlan(value: unknown): PaidPlan | null {
  return value === "pro" || value === "max" ? value : null;
}

export function asPeriod(value: unknown): Period {
  return value === "year" ? "year" : "month";
}

export type Billing = {
  plan: PlanId;
  /** When the paid plan or trial ends (ms), null for free. */
  until: number | null;
  trial: boolean;
  limits: Record<AiKind, number>;
  used: Record<AiKind, number>;
  refCode: string;
  referrals: number;
  refBonusDays: number;
  isAdmin: boolean;
};

export type PaymentOptions = { crypto: boolean; card: boolean; contact: string | null };
