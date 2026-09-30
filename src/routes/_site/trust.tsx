import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Database, HeartHandshake, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "@/components/site/shell";
import { useSiteStatus } from "@/lib/use-billing";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_site/trust")({
  head: () => ({ meta: [{ title: "Прозрачность и безопасность — Скан" }, { name: "description", content: "Откуда Скан берёт данные, как работает разбор ИИ, какие риски у крипторынка и как связаться с поддержкой." }] }),
  component: TrustPage,
});

function Card({ icon: Icon, title, children }: { icon: typeof Database; title: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
      <h2 className="mt-4 font-display text-lg font-bold text-fg">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
    </article>
  );
}

function TrustPage() {
  const t = useT();
  const status = useSiteStatus().data;
  const contact = status?.payments.contact;
  const supportHref = contact?.startsWith("@") ? `https://t.me/${contact.slice(1)}` : contact?.includes("@") ? `mailto:${contact}` : contact;

  return (
    <Container className="py-8 sm:py-12">
      <section className="relative overflow-hidden rounded-[28px] bg-slate-950 px-6 py-10 text-white shadow-[var(--shadow-pop)] sm:px-10">
        <div className="absolute -right-16 -top-24 size-72 rounded-full bg-accent/20 blur-3xl" aria-hidden />
        <p className="relative text-xs font-extrabold tracking-[.18em] text-accent">{t("trust.eyebrow")}</p>
        <h1 className="relative mt-3 max-w-2xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">{t("trust.title")}</h1>
        <p className="relative mt-4 max-w-2xl text-base leading-relaxed text-slate-300">{t("trust.subtitle")}</p>
      </section>

      <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card icon={Database} title={t("trust.dataTitle")}>{t("trust.dataText")}</Card>
        <Card icon={BadgeCheck} title={t("trust.methodTitle")}>{t("trust.methodText")}</Card>
        <Card icon={TriangleAlert} title={t("trust.riskTitle")}>{t("trust.riskText")}</Card>
        <Card icon={ShieldCheck} title={t("trust.accountTitle")}>{t("trust.accountText")}</Card>
      </section>

      <section className="mt-8 grid gap-5 rounded-3xl bg-surface-2 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-fg"><HeartHandshake className="size-5 text-accent" /><h2 className="font-display text-xl font-bold">{t("trust.helpTitle")}</h2></div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t(contact ? "trust.helpAvailable" : "trust.helpSetup")}</p>
        </div>
        {supportHref ? <a href={supportHref} target={supportHref.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-fg shadow-[var(--shadow-glow)] hover:opacity-90">{t("trust.contact")}</a> : <Link to="/pricing" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-fg shadow-[var(--shadow-glow)] hover:opacity-90">{t("trust.pro")}</Link>}
      </section>
    </Container>
  );
}
