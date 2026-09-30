import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CandlestickChart } from "lucide-react";
import { Container } from "@/components/site/shell";
import { CANDLE_GUIDE, type GuideText } from "@/lib/guide";
import { CANDLE_DOWN, CANDLE_UP } from "@/lib/candle-style";
import { getSiteOrigin } from "@/lib/seo";
import { useSettings } from "@/lib/settings-store";

export const Route = createFileRoute("/_site/guide/candles")({
  loader: async () => ({ origin: typeof window === "undefined" ? await getSiteOrigin().catch(() => "") : "" }),
  head: ({ loaderData }) => {
    // Always in Russian, the site's main language for search.
    const text = CANDLE_GUIDE.ru;
    const url = loaderData?.origin ? `${loaderData.origin}/guide/candles` : undefined;
    const article = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: text.title,
      description: text.description,
      inLanguage: "ru",
      ...(url ? { mainEntityOfPage: url } : {}),
    };
    return {
      meta: [
        { title: `${text.title} — Скан` },
        { name: "description", content: text.description },
        { property: "og:title", content: text.title },
        { property: "og:description", content: text.description },
        ...(url ? [{ property: "og:url", content: url }] : []),
      ],
      links: url ? [{ rel: "canonical", href: url }] : [],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(article).replace(/</g, "\\u003c") }],
    };
  },
  component: CandleGuidePage,
});

/** A green and a red candle with their parts labelled. */
function CandleAnatomy({ a }: { a: GuideText["anatomy"] }) {
  const label = "fill-[var(--color-muted)] text-[11px]";
  const line = "stroke-[var(--color-border)]";
  const candle = (x: number, color: string, top: number, bottom: number, high: number, low: number) => (
    <g>
      <line x1={x} x2={x} y1={high} y2={low} stroke={color} strokeWidth="2.5" />
      <rect x={x - 22} y={top} width="44" height={bottom - top} rx="3" fill={color} />
    </g>
  );
  // Price labels sit to the right of each candle, pointing at its level.
  const mark = (x: number, y: number, text: string) => (
    <g>
      <line x1={x + 25} x2={x + 52} y1={y} y2={y} className={line} />
      <text x={x + 56} y={y + 4} className={label}>{text}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 440 230" className="mx-auto w-full max-w-lg" role="img" aria-label={`${a.green}, ${a.red}`}>
      {/* Green: opens at the bottom of the body, closes at the top. */}
      {candle(100, CANDLE_UP, 60, 150, 25, 190)}
      <text x="100" y="220" textAnchor="middle" className="fill-[var(--color-fg)] text-[12px] font-bold">{a.green}</text>
      {mark(100, 25, a.high)}
      {mark(100, 60, a.close)}
      {mark(100, 150, a.open)}
      {mark(100, 190, a.low)}
      <text x="44" y="108" textAnchor="end" className={label}>{a.body}</text>
      <line x1="48" x2="76" y1="104" y2="104" className={line} />
      <text x="44" y="42" textAnchor="end" className={label}>{a.wick}</text>
      <line x1="48" x2="98" y1="38" y2="38" className={line} />

      {/* Red: opens at the top of the body, closes at the bottom. */}
      {candle(310, CANDLE_DOWN, 70, 160, 40, 200)}
      <text x="310" y="220" textAnchor="middle" className="fill-[var(--color-fg)] text-[12px] font-bold">{a.red}</text>
      {mark(310, 70, a.open)}
      {mark(310, 160, a.close)}
    </svg>
  );
}

function CandleGuidePage() {
  const lang = useSettings((s) => s.lang);
  const text = CANDLE_GUIDE[lang];
  return (
    <Container className="py-8 sm:py-12">
      <article className="mx-auto max-w-3xl">
        <p className="flex items-center gap-2 text-xs font-extrabold tracking-[.18em] text-primary uppercase">
          <BookOpen className="size-4" />
          {lang === "ru" ? "Обучение" : "Learn"}
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight font-extrabold text-fg sm:text-4xl">{text.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">{text.intro}</p>

        <figure className="mt-8 rounded-3xl bg-surface p-6 shadow-[var(--shadow-border)]">
          <CandleAnatomy a={text.anatomy} />
        </figure>

        {text.sections.map((section) => {
          const List = section.ordered ? "ol" : "ul";
          return (
            <section key={section.h} className="mt-10">
              <h2 className="font-display text-2xl font-bold text-fg">{section.h}</h2>
              {section.p.map((p) => (
                <p key={p} className="mt-3 text-[15px] leading-relaxed text-muted">
                  {p}
                </p>
              ))}
              {section.list ? (
                <List className={`mt-3 flex flex-col gap-2.5 pl-5 text-[15px] leading-relaxed text-muted ${section.ordered ? "list-decimal" : "list-disc"}`}>
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </List>
              ) : null}
            </section>
          );
        })}

        <div className="bg-brand mt-12 rounded-3xl p-7 text-center text-white shadow-[var(--shadow-glow)]">
          <CandlestickChart className="mx-auto size-8" />
          <p className="mx-auto mt-3 max-w-md text-sm text-white/85">{text.ctaText}</p>
          <Link
            to="/coins/$id"
            params={{ id: "bitcoin" }}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-primary hover:opacity-95"
          >
            {text.cta} <ArrowRight className="size-4" />
          </Link>
        </div>
      </article>
    </Container>
  );
}
