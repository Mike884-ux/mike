import { useQuery } from "@tanstack/react-query";
import { useCurrentUserState } from "./auth/use-current-user";
import { getBilling, getSiteStatus } from "./billing";

export const BILLING_KEY = ["billing"] as const;

/** The signed-in member's plan and today's AI usage (undefined for guests). */
export function useBilling() {
  const { user } = useCurrentUserState();
  return useQuery({
    queryKey: BILLING_KEY,
    queryFn: () => getBilling(),
    enabled: Boolean(user),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

export function useSiteStatus() {
  return useQuery({
    queryKey: ["site-status"],
    queryFn: () => getSiteStatus(),
    staleTime: 10 * 60_000,
  });
}

/** Days left until a timestamp, at least 1 while it's in the future. */
export function daysLeft(until: number | null | undefined, now = Date.now()): number {
  if (!until || until <= now) return 0;
  return Math.max(1, Math.ceil((until - now) / 86_400_000));
}
