import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Flame, Loader2, Search, X } from "lucide-react";
import type { SearchHit } from "@/lib/coins";
import { useT } from "@/lib/i18n";
import { useCoinSearch, useTrending } from "@/lib/use-market";
import { cn } from "@/lib/utils";
import { CoinLogo } from "@/components/market/bits";

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Coin search with a results dropdown. Empty input shows what's trending;
 * arrows + Enter work, "/" anywhere on the page focuses it.
 */
export function CoinSearch({ className, autoFocus, onDone }: { className?: string; autoFocus?: boolean; onDone?: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(Boolean(autoFocus));
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query, 200);
  const search = useCoinSearch(debounced);
  const trending = useTrending();

  const typing = query.trim().length > 0;
  const hits: SearchHit[] = useMemo(() => {
    if (typing) return search.data ?? [];
    return (trending.data ?? []).slice(0, 7).map(({ id, name, symbol, rank, image }) => ({ id, name, symbol, rank, image }));
  }, [typing, search.data, trending.data]);

  useEffect(() => setActive(0), [debounced]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !editing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    onDone?.();
    void navigate({ to: "/coins/$id", params: { id: hit.id } });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(hits.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      const hit = hits[active];
      if (hit) {
        event.preventDefault();
        go(hit);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      onDone?.();
    }
  };

  const loading = typing && (search.isFetching || debounced !== query);
  const showList = open && (hits.length > 0 || (typing && !loading));

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="flex h-9 items-center gap-2 rounded-xl bg-surface-2 px-3 ring-primary/40 focus-within:ring-2">
        <Search className="size-4 shrink-0 text-faint" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
        />
        {loading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-faint" />
        ) : query ? (
          <button type="button" onClick={() => setQuery("")} aria-label={t("common.clear")} className="text-faint hover:text-fg">
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="hidden rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint shadow-[var(--shadow-border)] sm:inline">/</kbd>
        )}
      </div>

      {showList ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 min-w-72 overflow-hidden rounded-2xl bg-surface p-1.5 shadow-[var(--shadow-pop)]">
          {!typing ? (
            <p className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-faint">
              <Flame className="size-3 text-wait" />
              {t("search.trending")}
            </p>
          ) : null}
          {hits.length ? (
            <ul id={listId} role="listbox" aria-label={t("search.placeholder")}>
              {hits.map((hit, i) => (
                <li key={hit.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(hit)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none",
                      i === active ? "bg-surface-2" : "",
                    )}
                  >
                    <CoinLogo src={hit.image} symbol={hit.symbol} className="size-6" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{hit.name}</span>
                    <span className="text-xs text-faint">{hit.symbol}</span>
                    {hit.rank ? <span className="w-10 text-right font-mono text-[11px] text-faint">#{hit.rank}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-center text-sm text-muted">{t("search.empty")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
