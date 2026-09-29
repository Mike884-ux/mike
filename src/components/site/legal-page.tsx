import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { LEGAL, LEGAL_DOCS, type LegalDoc } from "@/lib/legal";
import { useT, type MessageKey } from "@/lib/i18n";
import { useSettings } from "@/lib/settings-store";
import { useSiteStatus } from "@/lib/use-billing";
import { cn } from "@/lib/utils";
import { Container } from "@/components/site/shell";

export const LEGAL_LINK: Record<LegalDoc, MessageKey> = { terms: "legal.terms", privacy: "legal.privacy", refund: "legal.refund" };

/** Head tags for a legal page — always in Russian, the site's main language for search. */
export function legalHead(doc: LegalDoc) {
  const text = LEGAL[doc].ru;
  return { meta: [{ title: `${text.title} — Скан` }, { name: "description", content: text.description }] };
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const text = LEGAL[doc][lang];
  const contact = useSiteStatus().data?.payments.contact;
  const href = contact?.startsWith("@") ? `https://t.me/${contact.slice(1)}` : contact?.includes("@") ? `mailto:${contact}` : contact;

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <nav className="flex flex-wrap gap-2" aria-label={t("legal.nav")}>
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d}
              to={`/${d}`}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                d === doc ? "bg-primary text-primary-fg ring-primary" : "bg-surface text-muted ring-border hover:text-fg",
              )}
            >
              {t(LEGAL_LINK[d])}
            </Link>
          ))}
        </nav>
        <h1 className="mt-6 flex items-center gap-3 font-display text-3xl font-extrabold text-fg sm:text-4xl">
          <FileText className="size-7 text-primary" />
          {text.title}
        </h1>
        <p className="mt-2 text-xs text-faint">{text.updated}</p>
        <p className="mt-5 text-base leading-relaxed text-muted">{text.intro}</p>
        {text.sections.map((section) => (
          <section key={section.h} className="mt-8">
            <h2 className="font-display text-xl font-bold text-fg">{section.h}</h2>
            {section.p.map((p) => (
              <p key={p} className="mt-2.5 text-sm leading-relaxed text-muted">
                {p}
              </p>
            ))}
          </section>
        ))}
        <section className="mt-10 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg font-bold text-fg">{t("legal.contactTitle")}</h2>
          <p className="mt-1.5 text-sm text-muted">
            {href ? (
              <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="font-semibold text-primary hover:underline">
                {contact}
              </a>
            ) : (
              t("legal.contactSoon")
            )}
          </p>
        </section>
      </div>
    </Container>
  );
}

/** "By signing up / paying you accept …" with links to the documents. */
export function LegalConsent({ kind, className }: { kind: "signup" | "pay"; className?: string }) {
  const t = useT();
  const second: LegalDoc = kind === "signup" ? "privacy" : "refund";
  return (
    <p className={cn("text-[11px] leading-relaxed text-faint", className)}>
      {t(kind === "signup" ? "legal.consentSignup" : "legal.consentPay")}{" "}
      <Link to="/terms" target="_blank" className="underline hover:text-fg">
        {t("legal.termsAcc")}
      </Link>{" "}
      {t("legal.and")}{" "}
      <Link to={`/${second}`} target="_blank" className="underline hover:text-fg">
        {t(second === "privacy" ? "legal.privacyAcc" : "legal.refundAcc")}
      </Link>
      .
    </p>
  );
}
