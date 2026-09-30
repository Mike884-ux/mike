/**
 * "Sign in with Telegram" for the site opened inside Telegram — **server-only**.
 * POST /api/auth/sign-in/telegram { initData }: checks Telegram's signature,
 * finds or creates the account tied to that Telegram user and starts a
 * session, like any other sign-in. The chat with the bot is linked for alerts.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { telegramEmail, telegramName, verifyInitData } from "./telegram-init";

export const TELEGRAM_PROVIDER = "telegram";

export function telegramMiniApp(): BetterAuthPlugin {
  return {
    id: "telegram-mini-app",
    endpoints: {
      signInTelegram: createAuthEndpoint("/sign-in/telegram", { method: "POST" }, async (ctx) => {
        const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
        const body = (ctx.body ?? {}) as { initData?: unknown };
        const tgUser = verifyInitData(String(body.initData ?? "").slice(0, 4096), token);
        if (!tgUser) throw new APIError("UNAUTHORIZED", { message: "invalid telegram data" });

        const adapter = ctx.context.internalAdapter;
        const accountId = String(tgUser.id);
        const account = await adapter.findAccountByProviderId(accountId, TELEGRAM_PROVIDER);
        let user = account ? await adapter.findUserById(account.userId) : null;
        if (!user) {
          const created = await adapter.createOAuthUser(
            {
              email: telegramEmail(tgUser.id),
              emailVerified: true,
              name: telegramName(tgUser),
              image: tgUser.photo_url?.startsWith("https://") ? tgUser.photo_url : null,
            },
            { accountId, providerId: TELEGRAM_PROVIDER },
          );
          user = created.user;
        }
        const session = await adapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });
        await linkChat(user.id, tgUser.id, tgUser.username ?? null);
        return ctx.json({ ok: true });
      }),
    },
    rateLimit: [{ pathMatcher: (path) => path === "/sign-in/telegram", window: 60, max: 10 }],
  };
}

/** The bot's private chat with a user has the user's id: alerts can go there right away. */
async function linkChat(userId: string, chatId: number, username: string | null): Promise<void> {
  try {
    const { getSql } = await import("../db");
    const sql = await getSql();
    await sql`insert into telegram_links (user_id, chat_id, username) values (${userId}, ${chatId}, ${username})
      on conflict do nothing`;
  } catch (err) {
    console.error("[auth] telegram chat link failed:", err instanceof Error ? err.message : err);
  }
}
