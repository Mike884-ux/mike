import { authClient } from "./client";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
};

export type CurrentUserState = {
  user: AppUser | null;
  isPending: boolean;
};

export function useCurrentUserState(): CurrentUserState {
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  return {
    user: user
      ? { id: user.id, displayName: user.name ?? null, primaryEmail: user.email ?? null }
      : null,
    isPending,
  };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
