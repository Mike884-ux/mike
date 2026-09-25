import { createAuthClient } from "better-auth/react";

/** Better Auth client — same-origin cookie session, no external broker. */
export const authClient = createAuthClient();

export async function signOut(redirectTo = "/login"): Promise<void> {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message ?? "Sign-out failed");
  window.location.href = redirectTo;
}
