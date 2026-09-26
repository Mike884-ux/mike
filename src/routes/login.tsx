import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LoginScreen } from "@/components/login-screen";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type LoginSearch = { mode?: "signin" | "signup"; redirect?: string };

/** Only same-site paths: "/coins/bitcoin" yes, "//evil.test" or "https://…" no. */
function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") && value.length < 200
    ? value
    : undefined;
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    mode: search.mode === "signin" ? "signin" : search.mode === "signup" ? "signup" : undefined,
    redirect: safeRedirect(search.redirect),
  }),
  component: LoginPage,
});

/**
 * Already signed in? Go where they were heading instead of showing the form
 * again. The form shows right away while the session is checked — a blank
 * page for that moment looked broken on slow connections.
 */
function LoginPage() {
  const { mode, redirect } = Route.useSearch();
  const { user } = useCurrentUserState();
  if (user) return <Navigate to={redirect ?? "/"} />;
  return <LoginScreen initialMode={mode ?? "signup"} redirect={redirect ?? "/"} />;
}
