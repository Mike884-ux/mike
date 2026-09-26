import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT, type MessageKey } from "@/lib/i18n";
import { useAccount } from "@/lib/use-account";
import { WelcomeModal } from "@/components/account-menu";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { StatsBar } from "@/components/site/stats-bar";
import { useApplyPrefs } from "@/components/site/prefs";

/** First-login welcome and the one-time move of an old browser-only wallet. */
function MemberEffects() {
  const t = useT();
  const account = useAccount();
  return (
    <>
      {account.imported ? (
        <p role="status" className="bg-accent/12 px-4 py-2 text-center text-xs text-accent">
          {t("wallet.imported", { n: account.imported })}
        </p>
      ) : null}
      {account.needsWelcome ? <WelcomeModal onDone={account.dismissWelcome} /> : null}
    </>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  useApplyPrefs();
  const { user } = useCurrentUserState();
  return (
    <div className="flex min-h-dvh flex-col">
      <StatsBar />
      <SiteHeader />
      {user ? <MemberEffects /> : null}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Page width and padding shared by every section. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={`mx-auto w-full max-w-[1440px] px-4 sm:px-6 ${className ?? ""}`}>{children}</div>;
}

/** What a guest sees on a members-only page: what's inside, and how to get in. */
export function SignInPrompt({ title, text }: { title: MessageKey; text: MessageKey }) {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <Container className="py-16">
      <div className="fade-up mx-auto max-w-lg rounded-3xl bg-surface p-8 text-center shadow-[var(--shadow-border)]">
        <span className="bg-brand mx-auto grid size-12 place-items-center rounded-2xl text-white shadow-[var(--shadow-glow)]">
          <Lock className="size-5" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-fg">{t(title)}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t(text)}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            to="/login"
            search={{ mode: "signup", redirect: pathname }}
            className="bg-brand flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-[var(--shadow-glow)] hover:opacity-95"
          >
            <Sparkles className="size-4" />
            {t("gate.cta")}
          </Link>
          <Link
            to="/login"
            search={{ mode: "signin", redirect: pathname }}
            className="flex h-11 items-center justify-center rounded-xl bg-surface-2 px-5 text-sm font-semibold text-fg hover:bg-surface-3"
          >
            {t("gate.signin")}
          </Link>
        </div>
        <p className="mt-4 text-xs text-faint">{t("gate.free")}</p>
      </div>
    </Container>
  );
}

/** Renders children for signed-in users, a sign-in prompt for guests. */
export function MembersOnly({ title, text, children }: { title: MessageKey; text: MessageKey; children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <Container className="py-10">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton mt-4 h-64 w-full" />
      </Container>
    );
  }
  if (!user) return <SignInPrompt title={title} text={text} />;
  return <>{children}</>;
}
