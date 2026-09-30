/**
 * Search-engine texts for public pages: coin titles and descriptions rendered
 * on the server, so Google sees the price and name without running scripts.
 */
import { createServerFn } from "@tanstack/react-start";
import { isCoinId } from "./coins";
import { pctSigned, usdCompact, usdPrice } from "./format";

export type CoinSeo = {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number | null;
  marketCap: number | null;
  rank: number | null;
  image: string | null;
  about: string;
};

export const SITE_NAME = "Скан";

/** Cuts text at a word boundary so snippets don't end mid-word. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,.;:—-]+$/, "")}…`;
}

export function coinTitle(c: CoinSeo): string {
  return `${c.name} (${c.symbol}) — курс ${usdPrice(c.price)}, график и разбор ИИ | ${SITE_NAME}`;
}

export function coinDescription(c: CoinSeo): string {
  const parts = [`Курс ${c.name} (${c.symbol}) сегодня: ${usdPrice(c.price)}`];
  if (c.change24h !== null) parts[0] += `, ${pctSigned(c.change24h)} за 24 часа`;
  if (c.marketCap) parts.push(`капитализация ${usdCompact(c.marketCap)}${c.rank ? `, №${c.rank} по капитализации` : ""}`);
  parts.push("график, разбор ИИ и новости");
  const head = `${parts.join("; ")}.`;
  return clip(c.about ? `${head} ${c.about}` : head, 300);
}

/** The visible opening paragraph of a coin page. */
export function coinIntro(c: CoinSeo): string {
  const move = c.change24h === null ? "" : ` За сутки цена изменилась на ${pctSigned(c.change24h)}.`;
  const cap = c.marketCap ? ` Рыночная капитализация — ${usdCompact(c.marketCap)}${c.rank ? ` (${c.rank}-е место)` : ""}.` : "";
  return `Курс ${c.name} (${c.symbol}) сегодня — ${usdPrice(c.price)}.${move}${cap} Ниже — график, разбор ИИ и последние новости.`;
}

/** Breadcrumbs for search results: Home → Cryptocurrencies → coin. */
export function coinJsonLd(c: CoinSeo, origin: string): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: "Криптовалюты", item: `${origin}/` },
      { "@type": "ListItem", position: 3, name: `${c.name} (${c.symbol})`, item: `${origin}/coins/${c.id}` },
    ],
  };
  // "<" can't close the script tag early.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export type CoinSeoResult = { coin: CoinSeo | null; origin: string };

/** Coin data for the page head, or null when the coin is unknown or the data source is down. */
export const getCoinSeo = createServerFn({ method: "GET" })
  .validator((input: { id?: string }) => ({ id: String(input.id ?? "").toLowerCase() }))
  .handler(async ({ data }): Promise<CoinSeoResult> => {
    const [{ getRequest }, http] = await Promise.all([import("@tanstack/react-start/server"), import("./http.server")]);
    const request = getRequest();
    const origin = request ? http.siteOrigin(request) : "";
    if (!isCoinId(data.id)) return { coin: null, origin };
    // Random ids would each cost an upstream call — same budget as the coin API.
    if (request && http.overBudget(request, "coin-seo", 60)) return { coin: null, origin };
    const { getCoin } = await import("./coins.server");
    // Never hold the page for a slow upstream: the page itself loads the coin anyway.
    const found = await Promise.race([getCoin(data.id, "ru"), new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))]).catch(() => null);
    if (!found || "notFound" in found) return { coin: null, origin };
    const c = found.info;
    return {
      origin,
      coin: {
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        price: c.price,
        change24h: c.change24h,
        marketCap: c.marketCap,
        rank: c.rank,
        image: c.image,
        about: clip(c.description ?? "", 160),
      },
    };
  });

/** The site's public address, for canonical links of static pages. */
export const getSiteOrigin = createServerFn({ method: "GET" }).handler(async (): Promise<string> => {
  const [{ getRequest }, http] = await Promise.all([import("@tanstack/react-start/server"), import("./http.server")]);
  const request = getRequest();
  return request ? http.siteOrigin(request) : "";
});
