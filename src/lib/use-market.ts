import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  marketGet,
  MarketError,
  type CategoryId,
  type CoinInfo,
  type GlobalStats,
  type HistoryResponse,
  type ListingResponse,
  type RangeId,
  type SearchHit,
  type TrendingCoin,
} from "./coins";
import type { Lang } from "./lang";

/** A 404 is an answer, not a hiccup — don't retry it. */
function retryMarket(count: number, error: unknown) {
  if (error instanceof MarketError && (error.status === 404 || error.status === 429)) return false;
  return count < 2;
}

export function useGlobalStats() {
  return useQuery({
    queryKey: ["market", "global"],
    queryFn: () => marketGet<GlobalStats>("/api/market/global"),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: retryMarket,
  });
}

export function useListing(page: number, category?: CategoryId) {
  const params = new URLSearchParams({ page: String(page) });
  if (category) params.set("category", category);
  return useQuery({
    queryKey: ["market", "listing", page, category ?? "all"],
    queryFn: () => marketGet<ListingResponse>(`/api/market/listing?${params}`),
    staleTime: 45_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    retry: retryMarket,
  });
}

export function useWatchlist(symbols: string[]) {
  const key = [...symbols].sort().join(",");
  return useQuery({
    queryKey: ["market", "watchlist", key],
    queryFn: () => marketGet<ListingResponse>(`/api/market/listing?symbols=${encodeURIComponent(key)}`),
    enabled: symbols.length > 0,
    staleTime: 45_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    retry: retryMarket,
  });
}

export function useTrending() {
  return useQuery({
    queryKey: ["market", "trending"],
    queryFn: () => marketGet<TrendingCoin[]>("/api/market/trending"),
    staleTime: 240_000,
    refetchInterval: 300_000,
    retry: retryMarket,
  });
}

export function useCoinInfo(id: string, lang: Lang) {
  const descLang = lang === "ru" ? "ru" : "en";
  return useQuery({
    queryKey: ["market", "coin", id, descLang],
    queryFn: () => marketGet<CoinInfo>(`/api/market/coin/${encodeURIComponent(id)}?lang=${descLang}`),
    staleTime: 60_000,
    refetchInterval: 90_000,
    retry: retryMarket,
  });
}

export function useHistory(id: string, symbol: string | undefined, range: RangeId, price: number | undefined) {
  return useQuery({
    queryKey: ["market", "history", id, range, symbol ?? ""],
    queryFn: () => {
      const params = new URLSearchParams({ range, symbol: symbol ?? "" });
      // Rounded so the URL (and the CDN cache entry) stays the same between quotes.
      if (price) params.set("price", String(Number(price.toPrecision(2))));
      return marketGet<HistoryResponse>(`/api/market/history/${encodeURIComponent(id)}?${params}`);
    },
    enabled: Boolean(symbol),
    staleTime: range === "1d" ? 60_000 : 300_000,
    refetchInterval: range === "1d" ? 60_000 : false,
    placeholderData: keepPreviousData,
    retry: retryMarket,
  });
}

export function useCoinSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["market", "search", q.toLowerCase()],
    queryFn: () => marketGet<SearchHit[]>(`/api/market/search?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
    staleTime: 300_000,
    placeholderData: keepPreviousData,
    retry: retryMarket,
  });
}
