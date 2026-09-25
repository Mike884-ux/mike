import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Newspaper, RefreshCw } from "lucide-react";
import { getNews } from "@/lib/news";
import { timeAgo, useT, type MessageKey } from "@/lib/i18n";
import { useSettings } from "@/lib/settings-store";
import { Card } from "@/components/ui-bits";

type ToneFilter = "all" | "bull" | "bear";

const TONE_STYLE = {
  bull: "bg-long/15 text-long",
  bear: "bg-short/15 text-short",
  neutral: "bg-surface-2 text-muted",
} as const;

export function News() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const [filter, setFilter] = useState<ToneFilter>("all");
  const news = useQuery({
    queryKey: ["news", lang],
    queryFn: () => getNews({ data: { lang } }),
    staleTime: 120_000,
    refetchInterval: 180_000,
    retry: 0,
  });

  const items = useMemo(() => news.data ?? [], [news.data]);
  const counts = useMemo(() => {
    const c = { bull: 0, bear: 0, neutral: 0 };
    for (const item of items) c[item.tone ?? "neutral"] += 1;
    return c;
  }, [items]);
  const tagged = counts.bull + counts.bear + counts.neutral;
  const shown = filter === "all" ? items : items.filter((item) => item.tone === filter);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-fg sm:text-3xl">
            <Newspaper className="size-6 text-primary" />
            {t("news.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("news.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => void news.refetch()}
          disabled={news.isFetching}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-xs text-muted hover:text-fg disabled:opacity-50"
        >
          {news.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {t("common.refresh")}
        </button>
      </div>

      {tagged > 0 && (counts.bull || counts.bear) ? (
        <Card className="mt-4 p-3">
          <p className="text-[11px] text-faint">{t("news.mood")}</p>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-long" style={{ width: `${(counts.bull / tagged) * 100}%` }} />
            <div className="h-full bg-faint/40" style={{ width: `${(counts.neutral / tagged) * 100}%` }} />
            <div className="h-full bg-short" style={{ width: `${(counts.bear / tagged) * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px]">
            <span className="text-long">
              {t("news.tone.bull")} {counts.bull}
            </span>
            <span className="text-muted">
              {t("news.tone.neutral")} {counts.neutral}
            </span>
            <span className="text-short">
              {t("news.tone.bear")} {counts.bear}
            </span>
          </div>
        </Card>
      ) : null}

      <div className="mt-3 flex gap-1">
        {(["all", "bull", "bear"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`h-8 rounded-lg px-3 text-xs ${filter === f ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-fg"}`}
          >
            {f === "all" ? t("news.all") : t(`news.tone.${f}` as MessageKey)}
          </button>
        ))}
      </div>

      {news.isLoading ? (
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : shown.length ? (
        <ul className="mt-4 flex flex-col gap-2 pb-6">
          {shown.map((item) => (
            <li key={item.url || item.title}>
              <a
                href={item.url || undefined}
                target="_blank"
                rel="noreferrer noopener"
                className="group block rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] transition-colors hover:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed text-fg">{item.title}</p>
                  {item.url ? <ExternalLink className="mt-1 size-3.5 shrink-0 text-faint group-hover:text-fg" /> : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                  {item.tone ? (
                    <span className={`rounded-full px-2 py-0.5 font-medium ${TONE_STYLE[item.tone]}`}>{t(`news.tone.${item.tone}` as MessageKey)}</span>
                  ) : null}
                  {(item.bases ?? []).map((b) => (
                    <span key={b} className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-primary">
                      {b}
                    </span>
                  ))}
                  <span>{item.source}</span>
                  {item.publishedAt ? <span>· {timeAgo(lang, item.publishedAt)}</span> : null}
                </div>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-sm text-muted">{news.isError ? t("news.down") : t("news.empty")}</p>
      )}
    </div>
  );
}
