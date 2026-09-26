import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccount, updateSettings, walletImport, type Account } from "./account";
import { asCountry, asLang } from "./lang";
import { useCurrentUserState } from "./auth/use-current-user";
import { useSettings } from "./settings-store";

export const ACCOUNT_KEY = ["account"] as const;

/** The signed-in user's saved data, plus first-login and old-browser-wallet handling. */
export function useAccount() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ACCOUNT_KEY, queryFn: () => getAccount(), staleTime: 30_000 });
  const setLang = useSettings((s) => s.setLang);
  const setCountry = useSettings((s) => s.setCountry);
  const [needsWelcome, setNeedsWelcome] = useState(false);
  const [imported, setImported] = useState(0);
  const synced = useRef(false);

  useEffect(() => {
    const data = query.data;
    if (!data || synced.current) return;
    synced.current = true;
    if (data.settings.lang) {
      // Returning user: the account's choice wins over this device's.
      setLang(asLang(data.settings.lang));
      setCountry(asCountry(data.settings.country));
    } else {
      setNeedsWelcome(true);
    }
    // Older versions kept the wallet only in this browser — move it once.
    try {
      const raw = localStorage.getItem("scan-wallet");
      const local = raw ? (JSON.parse(raw) as { state?: { positions?: { base: string; qty: number; entry: number }[] } }) : null;
      const positions = local?.state?.positions ?? [];
      if (positions.length && data.positions.length === 0) {
        void walletImport({ data: { positions } }).then((res) => {
          localStorage.removeItem("scan-wallet");
          if (res.imported) {
            setImported(res.imported);
            void client.invalidateQueries({ queryKey: ACCOUNT_KEY });
          }
        });
      } else if (positions.length) {
        localStorage.removeItem("scan-wallet");
      }
    } catch {
      /* storage unavailable — nothing to import */
    }
  }, [query.data, setLang, setCountry, client]);

  return { ...query, needsWelcome, dismissWelcome: () => setNeedsWelcome(false), imported };
}

/** Save language / country / favorites to the account (optimistically). */
export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: { lang?: string; country?: string; favorites?: string[] }) => updateSettings({ data: patch }),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: ACCOUNT_KEY });
      const previous = client.getQueryData<Account>(ACCOUNT_KEY);
      if (previous) {
        client.setQueryData<Account>(ACCOUNT_KEY, {
          ...previous,
          settings: {
            lang: patch.lang ?? previous.settings.lang,
            country: patch.country ?? previous.settings.country,
            favorites: patch.favorites ?? previous.settings.favorites,
          },
        });
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) client.setQueryData(ACCOUNT_KEY, ctx.previous);
    },
  });
}

/**
 * Starred tickers ("BTC", "ETH"): the same list drives the watchlist tab on the
 * market page and the favourites filter on the signals page. Guests have none.
 */
export function useFavorites() {
  const { user } = useCurrentUserState();
  const account = useQuery({ queryKey: ACCOUNT_KEY, queryFn: () => getAccount(), staleTime: 30_000, enabled: Boolean(user) });
  const save = useSaveSettings();
  const favorites = useMemoStable(account.data?.settings.favorites);
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;
  const saveMutate = save.mutate;
  const toggle = useCallback(
    (symbol: string) => {
      const current = favoritesRef.current;
      const next = current.includes(symbol) ? current.filter((s) => s !== symbol) : [...current, symbol];
      saveMutate({ favorites: next });
    },
    [saveMutate],
  );
  return { favorites, toggle, signedIn: Boolean(user), loading: Boolean(user) && account.isLoading };
}

const EMPTY: string[] = [];

/** Same array identity while the contents are unchanged, so memoized rows don't re-render. */
function useMemoStable(list: string[] | undefined): string[] {
  const ref = useRef<string[]>(EMPTY);
  const next = list ?? EMPTY;
  if (next.length !== ref.current.length || next.some((v, i) => v !== ref.current[i])) ref.current = next;
  return ref.current;
}
