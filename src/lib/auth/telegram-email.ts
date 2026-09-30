/** Accounts made from Telegram have no real email; this stand-in never receives mail and is never shown. */
export const telegramEmail = (id: number) => `tg${id}@telegram.skan`;
export const isTelegramEmail = (email: string | null | undefined) => Boolean(email?.endsWith("@telegram.skan"));
