import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, KeyRound, Loader2, Lock, Mail, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { getAuthProviders, type AuthProviders } from "@/lib/auth/providers";
import { useT, type MessageKey } from "@/lib/i18n";
import { Mark } from "@/components/mark";
import { LangSwitcher } from "@/components/ui-bits";

function authErrorKey(error: unknown): MessageKey {
  const e = (typeof error === "object" && error ? error : {}) as { message?: string; status?: number; code?: string };
  const text = `${e.code ?? ""} ${e.message ?? ""}`.toLowerCase();
  if (e.status === 429 || /too many/.test(text)) return "login.err.tooMany";
  if (/already exists|registered|user_already/.test(text)) return "login.err.exists";
  if (/invalid (email or )?password|invalid credentials|invalid_email_or_password/.test(text)) return "login.err.invalid";
  if (/password.{0,12}(short|least|min)|too short/.test(text)) return "login.err.short";
  if (/otp.{0,10}expired|expired/.test(text)) return "login.err.codeExpired";
  if (/invalid.{0,6}otp|invalid code|too_many_attempts/.test(text)) return "login.err.code";
  return "login.err.generic";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="currentColor" d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.3l-4.9-6.4L5 21H1.9l7.3-8.3L1.5 3H8l4.4 5.9L17.5 3zm-1.1 16.2h1.7L7.1 4.7H5.3l11.1 14.5z" />
    </svg>
  );
}

/** Google / X buttons, shown only for providers the site has keys for. */
function SocialButtons({ redirect, busy, onError }: { redirect: string; busy: boolean; onError: (key: MessageKey) => void }) {
  const t = useT();
  const providers = useQuery({ queryKey: ["auth-providers"], queryFn: () => getAuthProviders(), staleTime: Infinity });
  const p = providers.data;
  if (!p || (!p.google && !p.twitter)) return null;
  const go = async (provider: "google" | "twitter") => {
    try {
      const { error } = await authClient.signIn.social({ provider, callbackURL: redirect, errorCallbackURL: "/login?error=social" });
      if (error) throw error;
    } catch (err) {
      onError(authErrorKey(err));
    }
  };
  const cls =
    "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface-2 text-sm font-semibold text-fg outline-none hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60";
  return (
    <div className="mt-5">
      <div className="flex gap-2">
        {p.google ? (
          <button type="button" disabled={busy} onClick={() => void go("google")} className={cls}>
            <GoogleIcon />
            Google
          </button>
        ) : null}
        {p.twitter ? (
          <button type="button" disabled={busy} onClick={() => void go("twitter")} className={cls}>
            <XIcon />
            X
          </button>
        ) : null}
      </div>
      <p className="my-4 flex items-center gap-3 text-[11px] text-faint before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        {t("login.or")}
      </p>
    </div>
  );
}

/** Decorative live-looking chart for the hero. Pure SVG, no data. */
function HeroChart() {
  const t = useT();
  const points = [62, 58, 64, 60, 70, 66, 74, 71, 80, 76, 86, 83, 92, 88, 97];
  const w = 360;
  const h = 120;
  const d = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * w).toFixed(1)} ${(h - ((v - 50) / 55) * h).toFixed(1)}`)
    .join(" ");
  return (
    <div className="fade-up relative mt-8 overflow-hidden rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] [animation-delay:200ms]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-wait/20 font-mono text-[10px] font-bold text-wait">₿</span>
          <span className="font-mono text-sm font-semibold text-fg">BTC</span>
          <span className="font-mono text-xs text-long">+2.84%</span>
        </div>
        <span className="rounded-full bg-long/15 px-2.5 py-1 text-[11px] font-semibold text-long uppercase">{t("signal.LONG")} · 71%</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-28 w-full" aria-hidden>
        <defs>
          <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
        </defs>
        <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="url(#heroFill)" />
        <path d={d} fill="none" stroke="url(#heroLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="draw-line" />
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        {[
          ["RSI", "61.4"],
          ["ADX", "29.8"],
          [t("detail.backtest"), "64%"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface-2 px-2.5 py-2">
            <p className="truncate text-faint">{label}</p>
            <p className="font-mono text-sm text-fg">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

type Mode = "signin" | "signup" | "code";

export function LoginScreen({ initialMode = "signup", redirect = "/", providers: initialProviders }: { initialMode?: Mode; redirect?: string; providers?: AuthProviders }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const providers = useQuery({ queryKey: ["auth-providers"], queryFn: () => getAuthProviders(), staleTime: Infinity, initialData: initialProviders });
  const codeAvailable = providers.data?.emailCode ?? false;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const mail = email.trim().toLowerCase();
    if (mode === "code") {
      if (!mail) return setError("login.err.empty");
      setError(null);
      setBusy(true);
      try {
        if (!codeSent) {
          const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email: mail, type: "sign-in" });
          if (err) throw err;
          setCodeSent(true);
          setBusy(false);
          return;
        }
        const otp = code.replace(/\D/g, "");
        if (otp.length < 6) {
          setBusy(false);
          return setError("login.err.code");
        }
        const { error: err } = await authClient.signIn.emailOtp({ email: mail, otp });
        if (err) throw err;
        window.location.href = redirect;
      } catch (err) {
        setError(authErrorKey(err));
        setBusy(false);
      }
      return;
    }
    if (!mail || !password) return setError("login.err.empty");
    if (password.length < 8) return setError("login.err.short");
    setError(null);
    setBusy(true);
    try {
      const { error: err } =
        mode === "signup"
          ? await authClient.signUp.email({ email: mail, password, name: mail.split("@")[0] || "Scan" })
          : await authClient.signIn.email({ email: mail, password });
      if (err) throw err;
      window.location.href = redirect;
    } catch (err) {
      setError(authErrorKey(err));
      setBusy(false);
    }
  }

  const modes: Mode[] = codeAvailable ? ["signup", "signin", "code"] : ["signup", "signin"];
  const modeLabel: Record<Mode, MessageKey> = { signup: "login.signup", signin: "login.signin", code: "login.byCode" };

  const features = [
    { icon: History, key: "login.f1" as const },
    { icon: Sparkles, key: "login.f2" as const },
    { icon: Wallet, key: "login.f3" as const },
  ];

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="aurora pointer-events-none absolute -inset-20 opacity-70" aria-hidden />
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <span className="bg-brand grid size-9 place-items-center rounded-xl shadow-[var(--shadow-glow)]">
              <Mark className="size-5 text-white" />
            </span>
            <span className="font-display text-lg font-bold text-fg">{t("app.name")}</span>
          </a>
          <LangSwitcher />
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <section className="fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3" />
              {t("login.eyebrow")}
            </span>
            <h1 className="text-gradient mt-4 font-display text-4xl leading-[1.05] font-bold sm:text-5xl">{t("login.headline")}</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{t("login.sub")}</p>
            <ul className="mt-6 flex flex-col gap-2.5">
              {features.map(({ icon: Icon, key }) => (
                <li key={key} className="flex items-center gap-3 text-sm text-fg">
                  <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-accent">
                    <Icon className="size-4" />
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>
            <div className="hidden max-w-md lg:block">
              <HeroChart />
            </div>
          </section>

          <section className="fade-up w-full max-w-md justify-self-center [animation-delay:120ms] lg:justify-self-end">
            <div className="rounded-3xl bg-surface p-6 shadow-[var(--shadow-border)] sm:p-8">
              <div className={`grid gap-1 rounded-xl bg-surface-2 p-1 ${modes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} role="tablist">
                {modes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    disabled={busy}
                    onClick={() => {
                      setMode(m);
                      setError(null);
                      setCodeSent(false);
                    }}
                    className={`h-10 rounded-lg text-sm font-medium transition-colors ${mode === m ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"}`}
                  >
                    {t(modeLabel[m])}
                  </button>
                ))}
              </div>

              <SocialButtons redirect={redirect} busy={busy} onError={setError} />

              <form className={`flex flex-col gap-3 ${providers.data && (providers.data.google || providers.data.twitter) ? "" : "mt-6"}`} onSubmit={submit}>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted">{t("login.email")}</span>
                  <span className="flex h-12 items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 focus-within:ring-2 focus-within:ring-primary/40">
                    <Mail className="size-4 text-faint" />
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={email}
                      disabled={busy}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-full flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
                    />
                  </span>
                </label>
                {mode === "code" && codeSent ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted">{t("login.codeLabel", { email: email.trim() })}</span>
                    <span className="flex h-12 items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 focus-within:ring-2 focus-within:ring-primary/40">
                      <KeyRound className="size-4 text-faint" />
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        value={code}
                        disabled={busy}
                        autoFocus
                        onChange={(event) => setCode(event.target.value)}
                        className="h-full flex-1 bg-transparent font-mono text-lg tracking-[0.3em] text-fg outline-none placeholder:text-faint"
                      />
                    </span>
                  </label>
                ) : null}
                {mode === "code" && !codeSent ? <p className="text-xs leading-relaxed text-muted">{t("login.codeHint")}</p> : null}
                <label className={`flex flex-col gap-1.5 ${mode === "code" ? "hidden" : ""}`}>
                  <span className="text-xs text-muted">
                    {t("login.password")} <span className="text-faint">· {t("login.passwordHint")}</span>
                  </span>
                  <span className="flex h-12 items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 focus-within:ring-2 focus-within:ring-primary/40">
                    <Lock className="size-4 text-faint" />
                    <input
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      placeholder="••••••••"
                      value={password}
                      disabled={busy}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-full flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
                    />
                  </span>
                </label>
                {error ? (
                  <p role="alert" className="rounded-lg bg-short/10 px-3 py-2 text-sm text-short">
                    {t(error)}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                  className="bg-brand mt-2 flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-[var(--shadow-glow)] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  {mode === "code"
                    ? t(busy ? (codeSent ? "login.entering" : "login.sendingCode") : codeSent ? "login.enter" : "login.sendCode")
                    : busy
                      ? t(mode === "signup" ? "login.creating" : "login.entering")
                      : t(mode === "signup" ? "login.create" : "login.enter")}
                </button>
                {mode === "code" && codeSent ? (
                  <button type="button" disabled={busy} onClick={() => setCodeSent(false)} className="text-xs text-primary hover:opacity-80">
                    {t("login.resend")}
                  </button>
                ) : null}
              </form>
              <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-faint">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" />
                {t("login.secure")}
              </p>
            </div>
            <p className="mt-4 text-center text-[11px] text-faint">{t("common.disclaimer")}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
