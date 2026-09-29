import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BILLING_KEY } from "@/lib/use-billing";
import { QuotaNote } from "@/components/billing/quota-note";
import { Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { chatWithAi, type ChatMessage } from "@/lib/chat";
import { useT, type MessageKey } from "@/lib/i18n";
import { useSettings } from "@/lib/settings-store";
import { stripMd } from "@/lib/utils";
import { AiFailure } from "@/components/billing/upsell";

const SUGGESTIONS: MessageKey[] = ["chat.s1", "chat.s2", "chat.s3", "chat.s4"];

/** One conversation with the AI: messages, sending, errors. Shared by the /ai page and the floating assistant. */
export function useChatSession(focus?: { base: string; name?: string } | null) {
  const lang = useSettings((s) => s.lang);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (next: ChatMessage[]) =>
      chatWithAi({ data: { messages: next, lang, focus: focus?.base, focusName: focus?.name } }),
    onSettled: () => void client.invalidateQueries({ queryKey: BILLING_KEY }),
  });

  function submit(text: string) {
    const clean = text.trim();
    if (!clean || mutation.isPending) return false;
    const next = [...messages, { role: "user" as const, text: clean }];
    setMessages(next);
    setError(null);
    mutation.mutate(next, {
      onSuccess: (res) => {
        if (res.ok) setMessages((m) => [...m, { role: "assistant", text: res.text }]);
        else setError(res.reason);
      },
      onError: () => setError("unavailable"),
    });
    return true;
  }

  function clear() {
    setMessages([]);
    setError(null);
  }

  return { messages, error, pending: mutation.isPending, submit, clear };
}

export function Chat({ initialQuestion }: { initialQuestion?: string } = {}) {
  const t = useT();
  const chat = useChatSession();
  const { messages, error } = chat;
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chat.pending]);

  // A question handed over from a coin page ("ask the AI about Bitcoin") is sent once on arrival.
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (!initialQuestion || asked.current === initialQuestion) return;
    asked.current = initialQuestion;
    submit(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit is stable enough for a one-shot send
  }, [initialQuestion]);

  function submit(text: string) {
    if (chat.submit(text)) setInput("");
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">{t("chat.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("chat.subtitle")}</p>
        </div>
        {messages.length ? (
          <button
            type="button"
            onClick={chat.clear}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-xs text-muted hover:text-fg"
          >
            <RotateCcw className="size-3.5" />
            {t("chat.clear")}
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex-1 overflow-y-auto rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">{t("chat.examples")}</p>
            {SUGGESTIONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => submit(t(key))}
                className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Sparkles className="size-3.5 shrink-0 text-primary" />
                {t(key)}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-primary text-primary-fg" : "bg-surface-2 text-fg"
                  }`}
                >
                  {stripMd(m.text)}
                </div>
              </div>
            ))}
            {chat.pending ? <p className="shimmer-text text-xs">{t("chat.typing")}</p> : null}
            {error ? <AiFailure reason={error} /> : null}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 flex items-center gap-2 pb-1"
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
          className="h-12 flex-1 rounded-full bg-surface-2 px-5 text-sm text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <button
          type="submit"
          disabled={!input.trim() || chat.pending}
          aria-label={t("chat.send")}
          className="bg-brand flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--shadow-glow)] disabled:opacity-50"
        >
          {chat.pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
      <QuotaNote kind="chat" className="px-5 pb-1" />
    </div>
  );
}
