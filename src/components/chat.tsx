import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, Sparkles } from "lucide-react";
import { chatWithAi, type ChatMessage } from "@/lib/chat";
import { stripMd } from "@/lib/utils";

const SUGGESTIONS = [
  "Какая стратегия лучше при высокой волатильности?",
  "Стоит ли усредняться, если позиция в минусе?",
  "Как выставлять стоп-лосс, если торгую с плечом?",
  "Объясни, что такое доминация биткоина и зачем на неё смотреть",
];

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const mutation = useMutation({
    mutationFn: (next: ChatMessage[]) => chatWithAi({ data: { messages: next } }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, mutation.isPending]);

  function submit(text: string) {
    const clean = text.trim();
    if (!clean || mutation.isPending) return;
    const next = [...messages, { role: "user" as const, text: clean }];
    setMessages(next);
    setInput("");
    setError(null);
    mutation.mutate(next, {
      onSuccess: (res) => {
        if (res.ok) setMessages((m) => [...m, { role: "assistant", text: res.text }]);
        else setError(res.error);
      },
      onError: () => setError("ИИ сейчас не ответил. Попробуй ещё раз."),
    });
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">Чат с ИИ</h1>
        <p className="mt-1 text-sm text-muted">
          Обсуди стратегию, риски или рынок в свободной форме — это ассистент, а не гарантия результата.
        </p>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">Например:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-left text-xs text-muted outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Sparkles className="size-3 shrink-0" />
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-primary text-primary-fg" : "bg-surface-2 text-fg"
                  }`}
                >
                  {stripMd(m.text)}
                </div>
              </div>
            ))}
            {mutation.isPending ? <p className="shimmer-text text-xs">ИИ печатает…</p> : null}
            {error ? <p className="text-xs text-short">{error}</p> : null}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex items-center gap-2 pb-1">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(input);
            }
          }}
          placeholder="Спроси про стратегию, риск, рынок…"
          className="h-11 flex-1 rounded-full bg-surface-2 px-4 text-sm text-fg outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        <button
          type="button"
          onClick={() => submit(input)}
          disabled={!input.trim() || mutation.isPending}
          aria-label="Отправить"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg outline-none disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </div>
  );
}
