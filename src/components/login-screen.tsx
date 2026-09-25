import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function authError(error: unknown): string {
  const raw =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: string }).message ?? "")
      : String(error ?? "");
  const text = raw.toLowerCase();
  if (/already exists|registered|user already/.test(text)) return "Этот email уже есть. Войди, не создавай заново.";
  if (/invalid password|invalid email or password|invalid credentials/.test(text)) {
    return "Неверный email или пароль.";
  }
  if (/password.{0,12}(short|least|min)/.test(text) || /too short/.test(text)) {
    return "Пароль слишком короткий. Минимум 8 символов.";
  }
  return raw.trim() || "Не получилось войти. Попробуй ещё раз.";
}

export function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!mail || !password) {
      setError("Введи email и пароль.");
      return;
    }
    if (password.length < 8) {
      setError("Пароль минимум 8 символов.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error: err } =
        mode === "signup"
          ? await authClient.signUp.email({ email: mail, password, name: mail.split("@")[0] || "Скан" })
          : await authClient.signIn.email({ email: mail, password });
      if (err) throw err;
      window.location.href = "/";
    } catch (err) {
      setError(authError(err));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Mark className="size-10 text-muted" />
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-fg">Скан</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Скан рынка по всем монетам сразу — график, сигнал и таймфрейм на выбор.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-sm bg-surface-2 p-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`h-9 rounded-sm text-sm ${mode === "signup" ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"}`}
          >
            Регистрация
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`h-9 rounded-sm text-sm ${mode === "signin" ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"}`}
          >
            Вход
          </button>
        </div>

        <form className="mt-4 flex flex-col gap-2" onSubmit={submit}>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="email"
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
            aria-label="Email"
          />
          <Input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="пароль, от 8 символов"
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
            aria-label="Пароль"
          />
          {error ? <p className="text-sm leading-relaxed text-short">{error}</p> : null}
          <Button type="submit" className="h-11 w-full" disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {mode === "signup" ? "Создаём…" : "Входим…"}
              </>
            ) : mode === "signup" ? (
              "Создать аккаунт"
            ) : (
              "Войти"
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
