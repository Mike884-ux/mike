import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { NewsItem } from "./types";

export const getNews = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { base?: string } = {}) => ({
    base: input.base ? String(input.base) : undefined,
  }))
  .handler(async ({ data }): Promise<NewsItem[]> => {
    const mod = await import("./news.server");
    return mod.queryHeadlines(data.base).catch(() => [] as NewsItem[]);
  });
