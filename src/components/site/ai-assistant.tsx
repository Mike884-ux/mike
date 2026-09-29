import { useEffect, useId, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { useAssistant } from "@/lib/assistant-store";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT, type MessageKey } from "@/lib/i18n";
import { cn, stripMd } from "@/lib/utils";
import { useChatSession } from "@/components/chat";
import { QuotaNote } from "@/components/billing/quota-note";
import { AiFailure } from "@/components/billing/upsell";

/** The site's AI mascot: a small robot with a visor and blinking eyes. */
export function RobotFace({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-head`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c9bff" />
          <stop offset="100%" stopColor="#4f5bea" />
        </linearGradient>
      </defs>
      <line x1="32" y1="5" x2="32" y2="13" stroke="#7c9bff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3.5" fill="#34d399" />
      <rect x="4" y="25" width="6" height="12" rx="3" fill="#4f5bea" />
      <rect x="54" y="25" width="6" height="12" rx="3" fill="#4f5bea" />
      <rect x="9" y="12" width="46" height="36" rx="15" fill={`url(#${id}-head)`} />
      <rect x="15" y="20" width="34" height="20" rx="10" fill="#0d1330" />
      <rect className="assistant-eye" x="22" y="25" width="6" height="9" rx="3" fill="#67e8f9" />
      <rect className="assistant-eye" x="36" y="25" width="6" height="9" rx="3" fill="#67e8f9" />
      <rect x="21" y="49" width="22" height="11" rx="5.5" fill="#4f5bea" />
      <path d="M27 54.5h10" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const COIN_QUESTIONS: MessageKey[] = ["assistant.q.full", "assistant.q.levels", "assistant.q.risks"];
const GENERAL_QUESTIONS: MessageKey[] = ["chat.s1", "chat.s2", "chat.s3", "chat.s4"];

function AssistantChat() {
  const t = useT();
  const focus = useAssistant((s) => s.focus);
  const chat = useChatSession(focus);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages, chat.pending, chat.error]);

  const send = (text: string) => {
    if (chat.submit(text)) setInput("");
  };
  const vars = { base: focus?.base ?? "" };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed text-fg">
            {focus ? t("assistant.helloCoin", vars) : t("assistant.hello")}
          </div>
          {chat.messages.length === 0 ? (
            <div className="flex flex-col gap-2">
              {(focus ? COIN_QUESTIONS : GENERAL_QUESTIONS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => send(t(key, vars))}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-muted ring-1 ring-border outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Sparkles className="size-3.5 shrink-0 text-primary" />
                  {t(key, vars)}
                </button>
              ))}
            </div>
          ) : (
            chat.messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user" ? "rounded-br-md bg-primary text-primary-fg" : "rounded-tl-md bg-surface-2 text-fg",
                  )}
                >
                  {stripMd(m.text)}
                </div>
              </div>
            ))
          )}
          {chat.pending ? (
            <p className="flex items-center gap-2 text-xs text-primary" role="status">
              <Loader2 className="size-3.5 animate-spin" />
              <span className="shimmer-text">{t("scan.ai.thinking")}</span>
            </p>
          ) : null}
          {chat.error ? <AiFailure reason={chat.error} /> : null}
          <div ref={bottomRef} />
        </div>
      </div>
      <form
        className="flex items-center gap-2 border-t border-border px-3 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
          autoFocus
          className="h-11 min-w-0 flex-1 rounded-full bg-surface-2 px-4 text-sm text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <button
          type="submit"
          disabled={!input.trim() || chat.pending}
          aria-label={t("chat.send")}
          className="bg-brand grid size-11 shrink-0 place-items-center rounded-full text-white shadow-[var(--shadow-glow)] disabled:opacity-50"
        >
          {chat.pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
      <div className="flex items-center justify-between gap-2 px-4 pt-1.5 pb-3">
        <QuotaNote kind="chat" />
        {chat.messages.length ? (
          <button type="button" onClick={chat.clear} className="flex shrink-0 items-center gap-1 text-[11px] text-faint hover:text-fg">
            <RotateCcw className="size-3" />
            {t("chat.clear")}
          </button>
        ) : null}
      </div>
    </>
  );
}

/**
 * The robot in the corner of every page: tap it to ask the AI. When a coin is
 * on screen the AI already knows which one and can give a full piece of advice.
 */
export function AiAssistant() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const open = useAssistant((s) => s.open);
  const setOpen = useAssistant((s) => s.setOpen);
  const focus = useAssistant((s) => s.focus);

  useEffect(() => {
    if (!open) return;
    // Capture first, so Esc closes only the assistant and not a coin window underneath.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, setOpen]);

  // The /ai page is a full chat already.
  if (pathname === "/ai") return null;

  return (
    <>
      {open ? (
        <section
          role="dialog"
          aria-label={t("assistant.title")}
          className="fade-up fixed inset-0 z-[70] flex flex-col bg-surface pt-[env(safe-area-inset-top)] sm:inset-auto sm:right-4 sm:bottom-[calc(8.5rem+env(safe-area-inset-bottom))] sm:h-[560px] sm:max-h-[calc(100dvh-10rem)] sm:w-[380px] sm:rounded-3xl sm:pt-0 sm:shadow-[var(--shadow-border),0_24px_60px_-12px_rgba(0,0,0,0.45)] lg:bottom-24"
        >
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <RobotFace className="size-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold text-fg">{t("assistant.title")}</p>
              <p className="truncate text-xs text-muted">
                {focus ? t("assistant.watching", { base: focus.name ? `${focus.name} (${focus.base})` : focus.base }) : t("assistant.general")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
              className="grid size-9 place-items-center rounded-lg text-muted outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="size-4" />
            </button>
          </header>
          {user ? (
            <AssistantChat />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <RobotFace className="size-20" />
              <p className="text-sm text-muted">{t("assistant.guest")}</p>
              <Link
                to="/login"
                search={{ mode: "signup", redirect: pathname }}
                onClick={() => setOpen(false)}
                className="bg-brand flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-[var(--shadow-glow)]"
              >
                <Sparkles className="size-4" />
                {isPending ? "…" : t("gate.cta")}
              </Link>
            </div>
          )}
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t("assistant.open")}
        aria-expanded={open}
        title={t("assistant.title")}
        className={cn(
          "fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] grid size-16 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/60 lg:bottom-6",
          open && "max-sm:hidden",
        )}
      >
        <span className="assistant-float relative block drop-shadow-[0_8px_16px_rgba(79,91,234,0.45)]">
          <RobotFace className="size-14" />
          {focus && !open ? (
            <span className="absolute -top-1 -left-2 rounded-full bg-primary px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary-fg shadow">
              {focus.base}
            </span>
          ) : null}
        </span>
      </button>
    </>
  );
}
