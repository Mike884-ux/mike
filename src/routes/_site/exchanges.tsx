import { createFileRoute } from "@tanstack/react-router";
import { Check, CircleHelp, ListChecks, Minus, Scale, X } from "lucide-react";
import { Container } from "@/components/site/shell";
import { ExchangeLogo, CountrySelect, DEPOSIT_KEY } from "@/components/exchange-picker";
import { availability, EXCHANGE_INFO, EXCHANGES, rankExchanges, tradeUrl, type Availability, type Exchange } from "@/lib/exchanges";
import { translate, useT, type MessageKey } from "@/lib/i18n";
import { COUNTRIES } from "@/lib/lang";
import { reportExchangeClick } from "@/lib/exchange-clicks";
import { getSiteOrigin } from "@/lib/seo";
import { useSettings } from "@/lib/settings-store";
import { useSiteStatus } from "@/lib/use-billing";
import { cn } from "@/lib/utils";

const FAQ = [1, 2, 3, 4] as const;
const ORDER = [...EXCHANGES].sort((a, b) => EXCHANGE_INFO[b].quality - EXCHANGE_INFO[a].quality);

export const Route = createFileRoute("/_site/exchanges")({
  loader: async () => ({ origin: typeof window === "undefined" ? await getSiteOrigin().catch(() => "") : "" }),
  head: ({ loaderData }) => {
    const ru = (key: MessageKey) => translate("ru", key);
    const url = loaderData?.origin ? `${loaderData.origin}/exchanges` : undefined;
    const faq = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((n) => ({
        "@type": "Question",
        name: ru(`ex.page.q${n}` as MessageKey),
        acceptedAnswer: { "@type": "Answer", text: ru(`ex.page.a${n}` as MessageKey) },
      })),
    };
    const list = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: ru("ex.page.title"),
      itemListElement: ORDER.map((id, i) => ({ "@type": "ListItem", position: i + 1, name: EXCHANGE_INFO[id].name })),
    };
    const json = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
    return {
      meta: [
        { title: ru("ex.page.metaTitle") },
        { name: "description", content: ru("ex.page.metaDescription") },
        { property: "og:title", content: ru("ex.page.metaTitle") },
        { property: "og:description", content: ru("ex.page.metaDescription") },
        ...(url ? [{ property: "og:url", content: url }] : []),
      ],
      links: url ? [{ rel: "canonical", href: url }] : [],
      scripts: [
        { type: "application/ld+json", children: json(list) },
        { type: "application/ld+json", children: json(faq) },
      ],
    };
  },
  component: ExchangesPage,
});

const MARK: Record<Availability, { icon: typeof Check; tone: string; label: MessageKey }> = {
  ok: { icon: Check, tone: "text-long", label: "ex.page.ok" },
  limited: { icon: Minus, tone: "text-wait", label: "ex.page.limited" },
  blocked: { icon: X, tone: "text-short", label: "ex.page.blocked" },
};

function ExchangesPage() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const country = useSettings((s) => s.country);
  const refs = useSiteStatus().data?.exchanges ?? null;
  const pick = rankExchanges({ country, refs }).recommended?.id ?? null;
  const countryName = COUNTRIES.find((c) => c.id === country)?.[lang] ?? country;
  const link = (id: Exchange) => tradeUrl(id, "BTC", refs?.[id]);

  return (
    <Container className="py-8 sm:py-12">
      <section className="relative overflow-hidden rounded-[28px] bg-slate-950 px-6 py-10 text-white shadow-[var(--shadow-pop)] sm:px-10">
        <div className="absolute -top-24 -right-16 size-72 rounded-full bg-primary/30 blur-3xl" aria-hidden />
        <p className="relative flex items-center gap-2 text-xs font-extrabold tracking-[.18em] text-accent uppercase">
          <Scale className="size-4" />
          {t("ex.page.eyebrow")}
        </p>
        <h1 className="relative mt-3 max-w-2xl font-display text-4xl leading-tight font-extrabold sm:text-5xl">{t("ex.page.title")}</h1>
        <p className="relative mt-4 max-w-2xl text-base leading-relaxed text-slate-300">{t("ex.page.intro")}</p>
        <div className="relative mt-6 flex flex-wrap items-center gap-3">
          <CountrySelect className="bg-white/10 text-white ring-white/15" />
          {pick ? (
            <p className="text-sm text-slate-300">
              {t("ex.page.forYou", { country: countryName })}: <strong className="text-white">{EXCHANGE_INFO[pick].name}</strong>
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-bold text-fg">{t("ex.page.tableTitle")}</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="border-b border-border text-left text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t("ex.page.colExchange")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("ex.page.colFees")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("ex.page.colDeposit")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("ex.page.colFeatures")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("ex.page.colBonus")}</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {ORDER.map((id) => {
                const info = EXCHANGE_INFO[id];
                const blocked = availability(id, country) === "blocked";
                return (
                  <tr key={id} className={cn("border-b border-border align-top last:border-0", pick === id && "bg-primary/6")}>
                    <th scope="row" className="px-4 py-4 text-left">
                      <span className="flex items-center gap-3">
                        <ExchangeLogo id={id} />
                        <span>
                          <span className="block font-semibold text-fg">{info.name}</span>
                          <span className="block text-xs font-normal text-faint">{t("ex.page.founded", { year: info.founded })}</span>
                        </span>
                      </span>
                    </th>
                    <td className="px-4 py-4 font-semibold text-fg tabular-nums">{t("ex.feeValue", { maker: info.maker, taker: info.taker })}</td>
                    <td className="px-4 py-4 text-muted">{info.deposits.map((d) => t(DEPOSIT_KEY[d]!)).join(", ")}</td>
                    <td className="max-w-[280px] px-4 py-4 text-muted">{t(`ex.feature.${id}` as MessageKey)}</td>
                    <td className="px-4 py-4 text-muted">{t("ex.bonus")}</td>
                    <td className="px-4 py-4 text-right">
                      {blocked ? (
                        <span className="text-xs text-faint">{t("ex.blocked")}</span>
                      ) : (
                        <a
                          href={link(id)}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          onClick={() => reportExchangeClick(id, country)}
                          className="inline-flex h-9 items-center rounded-xl px-4 text-xs font-bold whitespace-nowrap"
                          style={{ background: info.bg, color: info.fg }}
                        >
                          {t("ex.page.cta")} {info.name}
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold text-fg">{t("ex.page.availabilityTitle")}</h2>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
          {(["ok", "limited", "blocked"] as const).map((a) => {
            const M = MARK[a];
            return (
              <span key={a} className="inline-flex items-center gap-1.5">
                <M.icon className={cn("size-3.5", M.tone)} />
                {t(M.label)}
              </span>
            );
          })}
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead className="border-b border-border text-muted">
              <tr>
                <th scope="col" className="px-3 py-3 text-left font-semibold">{t("ex.page.colExchange")}</th>
                {COUNTRIES.filter((c) => c.id !== "OTHER").map((c) => (
                  <th key={c.id} scope="col" className={cn("px-2 py-3 text-center font-semibold", c.id === country && "text-primary")} title={c[lang]}>
                    <span className="block text-base">{c.flag}</span>
                    {c.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ORDER.map((id) => (
                <tr key={id} className="border-b border-border last:border-0">
                  <th scope="row" className="px-3 py-2.5 text-left text-sm font-semibold text-fg">{EXCHANGE_INFO[id].name}</th>
                  {COUNTRIES.filter((c) => c.id !== "OTHER").map((c) => {
                    const M = MARK[availability(id, c.id)];
                    return (
                      <td key={c.id} className={cn("px-2 py-2.5 text-center", c.id === country && "bg-primary/6")}>
                        <M.icon className={cn("mx-auto size-4", M.tone)} aria-label={t(M.label)} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-surface p-6 shadow-[var(--shadow-border)]">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-fg">
            <ListChecks className="size-5 text-primary" />
            {t("ex.page.howTitle")}
          </h2>
          <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-muted">
            {([1, 2, 3, 4] as const).map((n) => (
              <li key={n}>{t(`ex.page.how${n}` as MessageKey)}</li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-faint">{t("ex.partnerNote")}</p>
        </section>
        <section className="rounded-3xl bg-surface p-6 shadow-[var(--shadow-border)]">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-fg">
            <CircleHelp className="size-5 text-primary" />
            {t("ex.page.faqTitle")}
          </h2>
          <div className="mt-3 flex flex-col divide-y divide-border">
            {FAQ.map((n) => (
              <details key={n} className="group py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-fg marker:hidden">{t(`ex.page.q${n}` as MessageKey)}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(`ex.page.a${n}` as MessageKey)}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-faint">
        {t("ex.page.updated")} {t("ex.risk")}
      </p>
    </Container>
  );
}
