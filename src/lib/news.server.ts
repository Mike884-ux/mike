import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { buildSchema, graphql } from "graphql";
import { HEADLINES_QUERY } from "./news-query";
import type { NewsItem } from "./types";

const NEWS_TTL = 180_000;

type Sealed = { n: string; t: string; c: string };
type Memo = { at: number; value: Sealed | NewsItem[]; inflight?: Promise<unknown> };

const memo = new Map<string, Memo>();

const NEWS_FEEDS = [
  "https://cointelegraph.com/rss",
  "https://news.google.com/rss/search?q=bitcoin+OR+ethereum+OR+crypto&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=stock+market+OR+nasdaq+OR+s%26p+500&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=Apple+OR+Tesla+OR+Nvidia+OR+Microsoft+earnings&hl=en-US&gl=US&ceid=US:en",
];

const schema = buildSchema(`
  type NewsItem {
    title: String!
    source: String!
    url: String!
  }
  type Query {
    headlines(base: String): [NewsItem!]!
  }
`);

function rssKey() {
  const seed = process.env.BETTER_AUTH_SECRET || process.env.GEMINI_API_KEY || "scan-rss-https";
  return createHash("sha256").update(`scan.rss.v1:${seed}`).digest();
}

function sealRss(plain: string): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", rssKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    n: iv.toString("base64"),
    t: cipher.getAuthTag().toString("base64"),
    c: body.toString("base64"),
  };
}

function openRss(sealed: Sealed): string {
  const decipher = createDecipheriv("aes-256-gcm", rssKey(), Buffer.from(sealed.n, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.t, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(sealed.c, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit?.inflight) return hit.inflight as Promise<T>;
  if (hit && Date.now() - hit.at < NEWS_TTL) return hit.value as T;
  const inflight = load()
    .then((value) => {
      memo.set(key, { at: Date.now(), value: value as Sealed | NewsItem[] });
      return value;
    })
    .catch((err) => {
      memo.delete(key);
      throw err;
    });
  memo.set(key, { at: hit?.at ?? 0, value: hit?.value ?? { n: "", t: "", c: "" }, inflight });
  return inflight;
}

async function getHttpsText(url: string, timeoutMs = 5000): Promise<string | null> {
  if (!url.startsWith("https://")) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text || null;
  } catch {
    return null;
  }
}

function parseRss(xml: string): NewsItem[] {
  const items = xml.split(/<item[\s>]/i).slice(1);
  const out: NewsItem[] = [];
  for (const chunk of items) {
    const title = chunk.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1];
    const link = chunk.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1];
    const source =
      chunk.match(/<dc:creator>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/i)?.[1] ??
      chunk.match(/<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/i)?.[1] ??
      "лента";
    const clean = (value?: string) =>
      (value ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .trim();
    const t = clean(title);
    if (!t) continue;
    const url = clean(link);
    if (url && !url.startsWith("https://")) continue;
    out.push({ title: t, source: clean(source) || "лента", url });
    if (out.length >= 10) break;
  }
  return out;
}

function mergeNews(batches: NewsItem[][]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  // Round-robin across feeds instead of draining one at a time, so crypto and
  // stock-market sources both show up on the mixed "tape" instead of one feed
  // crowding the other out.
  const maxLen = Math.max(0, ...batches.map((b) => b.length));
  for (let i = 0; i < maxLen; i++) {
    for (const batch of batches) {
      const item = batch[i];
      if (!item) continue;
      const key = item.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= 16) return out;
    }
  }
  return out;
}

async function fetchRss(url: string): Promise<NewsItem[]> {
  const sealed = await once(`rss:${url}`, async () => {
    const xml = await getHttpsText(url);
    if (!xml) return { n: "", t: "", c: "" } satisfies Sealed;
    return sealRss(xml);
  });
  if (!sealed.c) return [];
  try {
    return parseRss(openRss(sealed));
  } catch {
    memo.delete(`rss:${url}`);
    return [];
  }
}

async function loadTape(): Promise<NewsItem[]> {
  return once("tape", async () => {
    const batches = await Promise.all(NEWS_FEEDS.map((url) => fetchRss(url)));
    return mergeNews(batches);
  });
}

const ALIASES: Record<string, string[]> = {
  BTC: ["BITCOIN", "BTC"],
  ETH: ["ETHEREUM", "ETH"],
  SOL: ["SOLANA", "SOL"],
  GOLD: ["GOLD", "XAU"],
  AAPL: ["APPLE", "AAPL"],
  NVDA: ["NVIDIA", "NVDA"],
  TSLA: ["TESLA", "TSLA"],
  MSFT: ["MICROSOFT", "MSFT"],
  AMZN: ["AMAZON", "AMZN"],
  GOOG: ["GOOGLE", "ALPHABET", "GOOG"],
  META: ["META", "FACEBOOK"],
};

function filterBase(all: NewsItem[], base?: string | null): NewsItem[] {
  if (!base) return all.slice(0, 12);
  const needle = base.toUpperCase();
  const keys = ALIASES[needle] ?? [needle];
  const matched = all.filter((item) => keys.some((k) => item.title.toUpperCase().includes(k)));
  return (matched.length ? matched : all).slice(0, 8);
}

const translateCache = new Map<string, { at: number; value: NewsItem[] }>();

/**
 * Titles come from English-language RSS feeds; translate them for a Russian-speaking reader.
 * Plain numbered lines instead of JSON: if Gemini's output gets cut off mid-way (it does,
 * often), we still keep the translated lines that did make it through instead of discarding
 * the whole batch over one unparsable trailing fragment.
 */
async function translateTitles(items: NewsItem[]): Promise<NewsItem[]> {
  if (!items.length) return items;
  const key = items.map((item) => item.title).join("|");
  const hit = translateCache.get(key);
  if (hit && Date.now() - hit.at < NEWS_TTL) return hit.value;
  const { completeAi } = await import("./ai.server");
  const raw = await completeAi({
    system:
      "Переведи каждый заголовок новости на русский язык, сохраняя смысл и названия компаний/монет. Ответь построчно: ровно одна переведённая строка на каждый исходный заголовок, в том же порядке и с той же нумерацией, без пояснений, без markdown.",
    user: items.map((item, i) => `${i + 1}. ${item.title}`).join("\n"),
    maxTokens: 2200,
    temperature: 0.2,
  });
  if (!raw) return items;
  const byIndex = new Map<number, string>();
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
    if (!match) continue;
    const idx = Number(match[1]) - 1;
    const text = match[2]!.trim();
    if (text) byIndex.set(idx, text);
  }
  if (!byIndex.size) return items;
  const result = items.map((item, i) => ({ ...item, title: byIndex.get(i) ?? item.title }));
  translateCache.set(key, { at: Date.now(), value: result });
  return result;
}

const root = {
  headlines: async ({ base }: { base?: string | null }) => translateTitles(filterBase(await loadTape(), base)),
};

export async function queryHeadlines(base?: string): Promise<NewsItem[]> {
  const result = await graphql({
    schema,
    source: HEADLINES_QUERY,
    rootValue: root,
    variableValues: { base: base ?? null },
  });
  const rows = (result.data as { headlines?: NewsItem[] } | undefined)?.headlines;
  return Array.isArray(rows) ? rows : [];
}

export async function fetchHeadlineTape(): Promise<NewsItem[]> {
  return queryHeadlines();
}

export async function fetchNews(base: string): Promise<NewsItem[]> {
  return queryHeadlines(base);
}
