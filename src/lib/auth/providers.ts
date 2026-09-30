import { createServerFn } from "@tanstack/react-start";

export type AuthProviders = { google: boolean; twitter: boolean; apple: boolean; emailCode: boolean; emailVerify: boolean };

/** Which sign-in methods this deployment has keys for, so the login page shows only working buttons. */
export const getAuthProviders = createServerFn({ method: "GET" }).handler(async (): Promise<AuthProviders> => {
  const [{ mailEnabled, emailVerificationRequired }, { appleEnabled }] = await Promise.all([import("../mail.server"), import("./apple.server")]);
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    twitter: Boolean(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET),
    apple: appleEnabled(),
    emailCode: mailEnabled(),
    emailVerify: emailVerificationRequired(),
  };
});
