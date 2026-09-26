import { Link, useRouterState } from "@tanstack/react-router";
import { Bot, Coins, LineChart, UserRound, Wallet } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useHydrated } from "@/lib/use-hydrated";
import { useT, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useProfileDrawer } from "@/components/site/profile-drawer";

const TABS = [
  { to: "/", label: "tab.coins", icon: Coins, exact: true },
  { to: "/signals", label: "tab.signals", icon: LineChart, exact: false },
  { to: "/ai", label: "tab.ai", icon: Bot, exact: false },
  { to: "/portfolio", label: "tab.portfolio", icon: Wallet, exact: false },
] as const satisfies readonly { to: string; label: MessageKey; icon: unknown; exact: boolean }[];

const item = "flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[10.5px] font-semibold outline-none";

/** Phone navigation, app-style: the main sections and the profile always one tap away. */
export function TabBar() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCurrentUserState();
  // The server never knows the session: render the guest tab first, the profile after hydration.
  const signedIn = useHydrated() && Boolean(user);
  const open = useProfileDrawer((s) => s.open);
  const show = useProfileDrawer((s) => s.show);
  return (
    <nav
      aria-label={t("nav.menu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex h-14 max-w-lg">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
          return (
            <Link key={tab.to} to={tab.to} className={cn(item, active && !open ? "text-primary" : "text-muted")} aria-current={active ? "page" : undefined}>
              <Icon className="size-5" />
              {t(tab.label)}
            </Link>
          );
        })}
        {signedIn ? (
          <button type="button" onClick={show} className={cn(item, open ? "text-primary" : "text-muted")} aria-haspopup="dialog">
            <UserRound className="size-5" />
            {t("tab.profile")}
          </button>
        ) : (
          <Link to="/login" search={{ mode: "signup", redirect: pathname }} className={cn(item, "text-muted")}>
            <UserRound className="size-5" />
            {t("tab.signin")}
          </Link>
        )}
      </div>
    </nav>
  );
}
