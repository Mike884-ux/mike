import { createFileRoute } from "@tanstack/react-router";
import { Scanner } from "@/components/scanner";
import { LoginScreen } from "@/components/login-screen";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return null;
  if (!user) return <LoginScreen />;
  return <Scanner account={user} />;
}
