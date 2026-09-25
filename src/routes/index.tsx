import { createFileRoute } from "@tanstack/react-router";
import { Scanner } from "@/components/scanner";
import { LoginScreen } from "@/components/login-screen";
import { Mark } from "@/components/mark";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="bg-brand grid size-12 animate-pulse place-items-center rounded-2xl shadow-[var(--shadow-glow)]">
          <Mark className="size-6 text-white" />
        </span>
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  return <Scanner />;
}
