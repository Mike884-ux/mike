import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { buildSchema, graphql } from "graphql";
import { HEADLINES_QUERY } from "./news-query";
import { assetOf, detectBaseInText } from "./markets";
import { z } from "zod";
import type { Lang } from "./lang";
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
    const pub = Date.parse(clean(chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]));
    const base = detectBaseInText(t);
    out.push({
      title: t,
      source: clean(source) || "лента",
      url,
      ...(Number.isFinite(pub) ? { publishedAt: pub } : {}),
      ...(base ? { bases: [base] } : {}),
    });
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word patterns for an asset: its ticker plus known names ("DOGECOIN", "APPLE"). */
function patternsFor(base: string): RegExp[] {
  const keys = new Set([base, ...(ALIASES[base] ?? [])]);
  for (const alias of assetOf(base)?.aliases ?? []) {
    // Cyrillic aliases never appear in the English feeds; 1-2 letter ones are too noisy.
    if (/^[a-z0-9 .-]{3,}$/i.test(alias)) keys.add(alias.toUpperCase());
  }
  return [...keys].map((key) => new RegExp(`(^|[^A-Z0-9])${escapeRegExp(key)}([^A-Z0-9]|$)`));
}

/**
 * Headlines about one asset. Matches whole words only: a plain substring test
 * made "V" (Visa) or "OP" match almost every headline. When nothing matches we
 * return nothing instead of the general tape, so the coin view and the AI
 * prompt never present unrelated news as news about this asset.
 */
function filterBase(all: NewsItem[], base?: string | null): NewsItem[] {
  if (!base) return all.slice(0, 12);
  const patterns = patternsFor(base.toUpperCase());
  return all.filter((item) => patterns.some((re) => re.test(item.title.toUpperCase()))).slice(0, 8);
}

const enrichCache = new Map<string, { at: number; value: NewsItem[] }>();

const EnrichSchema = z.object({
  items: z.array(z.object({ index: z.number(), title: z.string(), tone: z.enum(["bull", "bear", "neutral"]) })),
});

/**
 * One AI pass per batch: translate titles into the reader's language and tag
 * each headline's market mood. If the AI is unavailable the original English
 * headlines are returned untouched — news still works without a key.
 */
async function enrichHeadlines(items: NewsItem[], lang: Lang): Promise<NewsItem[]> {
  if (!items.length) return items;
  const key = `${lang}|${items.map((item) => item.title).join("|")}`;
  const hit = enrichCache.get(key);
  if (hit && Date.now() - hit.at < NEWS_TTL) return hit.value;
  const { completeJson } = await import("./ai.server");
  const result = await completeJson(
    {
      system:
        "You process market headlines. For each numbered headline return its index, the title rewritten in the target language (keep company and coin names; if the target language is English keep the original title), and tone: bull if it is likely good for prices of the assets it mentions, bear if likely bad, neutral otherwise.",
      messages: [{ role: "user", text: items.map((item, i) => `${i}. ${item.title}`).join("\n") }],
      effort: "low",
      maxTokens: 4000,
      lang,
    },
    EnrichSchema,
  );
  if (!result.ok) return items;
  const byIndex = new Map(result.value.items.map((row) => [row.index, row]));
  const enriched = items.map((item, i) => {
    const row = byIndex.get(i);
    return row ? { ...item, title: row.title.trim() || item.title, tone: row.tone } : item;
  });
  enrichCache.set(key, { at: Date.now(), value: enriched });
  return enriched;
}

const root = {
  headlines: async ({ base }: { base?: string | null }) => filterBase(await loadTape(), base),
};

/** Headlines (optionally about one asset), translated and mood-tagged for `lang`. Pass "en" plus `raw` for AI prompts. */
export async function queryHeadlines(base?: string, lang: Lang | "raw" = "ru"): Promise<NewsItem[]> {
  const result = await graphql({
    schema,
    source: HEADLINES_QUERY,
    rootValue: root,
    variableValues: { base: base ?? null },
  });
  const rows = (result.data as { headlines?: NewsItem[] } | undefined)?.headlines;
  const list = Array.isArray(rows) ? rows : [];
  return lang === "raw" ? list : enrichHeadlines(list, lang);
}

export async function fetchHeadlineTape(): Promise<NewsItem[]> {
  return queryHeadlines();
}

export async function fetchNews(base: string): Promise<NewsItem[]> {
  return queryHeadlines(base);
}
