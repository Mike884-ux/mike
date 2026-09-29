/** Client state for sending people to an exchange: the picker window and the ranking for a coin. */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { getExchangePairs } from "./exchange-pairs";
import { isTradable, rankExchanges } from "./exchanges";
import { useSettings } from "./settings-store";
import { useSiteStatus } from "./use-billing";

type PickerState = {
  target: { symbol: string; name?: string } | null;
  openFor: (symbol: string, name?: string) => void;
  close: () => void;
};

/** One picker for the whole site; any "Trade" button opens it. */
export const useTradePicker = create<PickerState>((set) => ({
  target: null,
  openFor: (symbol, name) => set({ target: { symbol: symbol.toUpperCase(), name } }),
  close: () => set({ target: null }),
}));

/** Which exchanges to suggest for this coin, for this visitor. */
export function useExchangeRanking(symbol: string | null | undefined) {
  const base = (symbol ?? "").toUpperCase();
  const enabled = Boolean(base) && isTradable(base);
  const pairs = useQuery({
    queryKey: ["exchange-pairs", base],
    queryFn: () => getExchangePairs({ data: { base } }),
    enabled,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const refs = useSiteStatus().data?.exchanges ?? null;
  const country = useSettings((s) => s.country);
  const favorite = useSettings((s) => s.exchange);
  const ranking = useMemo(() => rankExchanges({ country, pairs: pairs.data ?? null, favorite, refs }), [country, pairs.data, favorite, refs]);
  return { ranking, loading: enabled && pairs.isLoading, country, refs };
}
