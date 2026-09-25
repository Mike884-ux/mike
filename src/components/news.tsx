import { useQuery } from "@tanstack/react-query";
import { Newspaper, RefreshCw, Loader2 } from "lucide-react";
import { getNews } from "@/lib/news";

export function News() {
  const news = useQuery({
    queryKey: ["news"],
    queryFn: () => getNews({ data: {} }),
    staleTime: 120_000,
    refetchInterval: 180_000,
    retry: 0,
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-fg">
            <Newspaper className="size-5 text-muted" />
            Новости рынка
          </h1>
          <p className="mt-1 text-sm text-muted">Свежие заголовки по крипте и макро.</p>
        </div>
        <button
          type="button"
          onClick={() => void news.refetch()}
          disabled={news.isFetching}
          className="flex h-9 items-center gap-1.5 rounded-sm bg-surface-2 px-3 text-xs text-muted outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-fg disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {news.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Обновить
        </button>
      </div>

      {news.isLoading ? (
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : news.data?.length ? (
        <ul className="mt-6 flex flex-col gap-2 pb-6">
          {news.data.map((item) => (
            <li key={item.title}>
              <a
                href={item.url || undefined}
                target="_blank"
                rel="noreferrer noopener"
                className="block rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] transition-shadow duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:shadow-[0_0_0_1px_rgba(243,241,236,0.16)]"
              >
                <p className="text-sm leading-relaxed text-fg">{item.title}</p>
                <p className="mt-1.5 text-xs text-faint">{item.source}</p>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-sm text-muted">
          {news.isError ? "Лента сейчас не отвечает." : "Заголовков пока нет."}
        </p>
      )}
    </div>
  );
}
