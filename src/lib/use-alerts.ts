import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserState } from "./auth/use-current-user";
import { connectTelegram, disconnectTelegram, getAlerts, removeAlert } from "./alerts";

export const ALERTS_KEY = ["alerts"] as const;

/** The member's alerts, limit and Telegram link (undefined for guests). */
export function useAlerts() {
  const { user } = useCurrentUserState();
  return useQuery({ queryKey: ALERTS_KEY, queryFn: () => getAlerts(), enabled: Boolean(user), staleTime: 15_000 });
}

export function useRemoveAlert() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeAlert({ data: { id } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ALERTS_KEY }),
  });
}

/**
 * Opens the bot with a one-time code. The tab is opened before the request so
 * phone browsers don't block it as a pop-up.
 */
export function useConnectTelegram() {
  return useMutation({
    mutationFn: async () => {
      const tab = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
      const res = await connectTelegram();
      if (res.ok) {
        if (tab) tab.location.href = res.url;
        else window.location.href = res.url;
      } else tab?.close();
      return res;
    },
  });
}

export function useDisconnectTelegram() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => disconnectTelegram(),
    onSuccess: () => void client.invalidateQueries({ queryKey: ALERTS_KEY }),
  });
}
