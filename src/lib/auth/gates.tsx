import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { ChevronDown, LogOut } from "lucide-react";
import { signOut } from "./client";
import { useCurrentUser, useCurrentUserState } from "./use-current-user";

export const SIGN_IN_PATH = "/login";

export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  return <Navigate to={to} />;
}

export function UserButton() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Аккаунт";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-fg">
          {initial}
        </span>
        <span className="hidden text-sm font-medium text-fg sm:inline">{label}</span>
        <ChevronDown className={`size-3.5 text-faint transition-transform duration-[var(--motion-quick)] ease-[var(--ease-out)] ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)]">
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-fg">{user.displayName ?? "Аккаунт"}</p>
            {user.primaryEmail ? <p className="truncate text-xs text-faint">{user.primaryEmail}</p> : null}
          </div>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut().catch(() => setSigningOut(false));
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-short outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:bg-short/10 disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut className="size-3.5" />
            {signingOut ? "Выходим…" : "Выйти"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
