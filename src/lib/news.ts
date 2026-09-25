import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asLang } from "./lang";
import type { NewsItem } from "./types";

export const getNews = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { base?: string; lang?: string } = {}) => ({
    base: input.base ? String(input.base).toUpperCase().slice(0, 12) : undefined,
    lang: asLang(input.lang),
  }))
  .handler(async ({ data }): Promise<NewsItem[]> => {
    const mod = await import("./news.server");
    return mod.queryHeadlines(data.base, data.lang).catch(() => [] as NewsItem[]);
  });
