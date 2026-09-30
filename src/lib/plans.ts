/** Subscription plans — shared by server and client. Prices in US dollars. */

export const PLAN_IDS = ["free", "pro", "max"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type PaidPlan = Exclude<PlanId, "free">;
export const PERIODS = ["month", "year"] as const;
export type Period = (typeof PERIODS)[number];

/** What costs AI money, counted per day (UTC). */
export const AI_KINDS = ["analysis", "chat", "advice", "strategy"] as const;
export type AiKind = (typeof AI_KINDS)[number];

/** Shared calendar-month credits; daily limits remain an additional burst cap. */
export const AI_CREDIT_COST: Record<AiKind, number> = { analysis: 5, chat: 1, advice: 5, strategy: 10 };
export const MONTHLY_CREDITS: Record<PlanId, number> = { free: 10, pro: 600, max: 1600 };
export const TRIAL_CREDITS = 40;
export type CreditBalance = { used: number; limit: number; resetsAt: string };

/** Alerts a member can keep switched on at once, and which kinds a plan allows. */
export const ALERT_LIMITS: Record<PlanId, number> = { free: 2, pro: 25, max: 100 };
export const SAVED_SCREEN_LIMITS: Record<PlanId, number> = { free: 0, pro: 10, max: 30 };

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
    // 10 credits a month: two coin analyses, or ten chat messages.
    limits: { analysis: 2, chat: 10, advice: 1, strategy: 0 },
  },
  pro: {
    id: "pro",
    month: 14.99,
    year: yearly(14.99),
    limits: { analysis: 50, chat: 150, advice: 10, strategy: 5 },
  },
  max: {
    id: "max",
    month: 39.99,
    year: yearly(39.99),
    limits: { analysis: 150, chat: 500, advice: 40, strategy: 20 },
  },
};

/** Names shown to people. The top plan is stored as "max" but sold as "Whale". */
export const PLAN_LABEL: Record<PlanId, string> = { free: "Free", pro: "Pro", max: "Whale" };

/** Pro days promised to people on the waiting list while online payment is not live. */
export const WAITLIST_GIFT_DAYS = 14;

export const PERIOD_DAYS: Record<Period, number> = { month: 30, year: 365 };

/** Free Pro days for a new account: none — Pro days are earned by inviting friends. */
export const TRIAL_DAYS = 0;
/** Every this many friends who join by a member's link earn the member Pro days, up to the cap. */
export const REFERRAL_FRIENDS = 3;
export const REFERRAL_BONUS_DAYS = 3;
export const REFERRAL_BONUS_CAP = 30;

/**
 * Telegram Stars price for one month (Stars payments are monthly). Buyers pay
 * about $0.02 a star; the owner receives about $0.013 a star.
 */
export const STAR_PRICES: Record<PaidPlan, number> = { pro: 1150, max: 3000 };

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
  credits: CreditBalance;
};

export type PaymentOptions = {
  crypto: boolean;
  card: boolean;
  /**
   * Smallest card payment in USD when cards go through NOWPayments' on-ramp
   * (its card partner has a minimum); null when any amount works.
   */
  cardMin: number | null;
  contact: string | null;
  /** Telegram Stars through the site's bot (monthly plans). */
  stars?: boolean;
};
