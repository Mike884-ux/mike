import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LoginScreen } from "@/components/login-screen";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

/** Already signed in? Go straight to the scanner instead of showing the form again. */
function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return null;
  if (user) return <Navigate to="/" />;
  return <LoginScreen />;
}
