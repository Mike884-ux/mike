/** Replies to messages sent to the site's Telegram bot — **server-only**. */
import { alertLabel, botLang, botText, coinMessage, escapeHtml, sendMessage, tg, type BotLang } from "./telegram.server.ts";

type TgUpdate = {
  message?: {
    chat?: { id?: number; type?: string };
    from?: { username?: string; language_code?: string };
    text?: string;
    successful_payment?: { currency?: string; total_amount?: number; invoice_payload?: string; telegram_payment_charge_id?: string };
  };
  pre_checkout_query?: { id?: string; currency?: string; total_amount?: number; invoice_payload?: string; from?: { language_code?: string } };
};

/** Telegram waits up to 10 s for this answer before it cancels the payment. */
async function answerPreCheckout(query: NonNullable<TgUpdate["pre_checkout_query"]>): Promise<void> {
  if (!query.id) return;
  const [{ getSql }, store] = await Promise.all([import("./db"), import("./billing-store.server")]);
  const ok = await store
    .starsPaymentOk(await getSql(), String(query.invoice_payload ?? ""), String(query.currency ?? ""), Number(query.total_amount))
    .catch(() => false);
  const en = botLang(query.from?.language_code) === "en";
  await tg("answerPreCheckoutQuery", {
    pre_checkout_query_id: query.id,
    ok,
    ...(ok ? {} : { error_message: en ? "This invoice is no longer valid. Open the plans page and try again." : "Этот счёт уже недействителен. Откройте страницу тарифов и попробуйте ещё раз." }),
  });
}

async function settleStarsPayment(
  chat: string,
  lang: BotLang,
  paid: NonNullable<NonNullable<TgUpdate["message"]>["successful_payment"]>,
  site: string,
): Promise<void> {
  const [{ getSql }, store, { PLAN_LABEL }] = await Promise.all([import("./db"), import("./billing-store.server"), import("./plans")]);
  const sql = await getSql();
  const { outcome, payment } = await store.settleStars(
    sql,
    String(paid.invoice_payload ?? ""),
    String(paid.telegram_payment_charge_id ?? ""),
    Number(paid.total_amount),
  );
  console.log(`[billing] telegram stars ${paid.invoice_payload}: ${outcome}`);
  if (!payment || (outcome !== "granted" && outcome !== "already")) return;
  const state = await store.loadPlan(sql, payment.userId);
  const until = state.until ? new Date(state.until).toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU") : "—";
  await sendMessage(chat, botText(lang, "paid", { plan: PLAN_LABEL[payment.plan], until, site }));
}

const TICKER = /^\/?([a-z0-9]{2,12})(@\w+)?$/i;

async function userLang(sql: import("./billing-store.server").SqlLike, userId: string | null, fallback: BotLang): Promise<BotLang> {
  if (!userId) return fallback;
  const [row] = await sql<{ lang: string }>`select lang from user_settings where user_id = ${userId}`;
  return row ? botLang(row.lang) : fallback;
}

/** Handles one update. Never throws: Telegram retries failed deliveries and would repeat the answer. */
export async function handleUpdate(update: TgUpdate, site: string): Promise<void> {
  if (update.pre_checkout_query) {
    await answerPreCheckout(update.pre_checkout_query).catch((err) =>
      console.error("[telegram] pre-checkout failed:", err instanceof Error ? err.message : err),
    );
    return;
  }
  const message = update.message;
  const chatId = message?.chat?.id;
  if (chatId && message?.successful_payment) {
    await settleStarsPayment(String(chatId), botLang(message.from?.language_code), message.successful_payment, site).catch((err) =>
      console.error("[telegram] payment failed:", err instanceof Error ? err.message : err),
    );
    return;
  }
  const text = message?.text?.trim();
  if (!chatId || !text || message?.chat?.type !== "private") return;
  const [{ getSql }, store] = await Promise.all([import("./db"), import("./alerts-store.server")]);
  const sql = await getSql();
  const chat = String(chatId);
  let lang = botLang(message.from?.language_code);
  const reply = (body: string) => sendMessage(chat, body);

  try {
    const [command, arg] = text.split(/\s+/, 2) as [string, string | undefined];
    const cmd = command.toLowerCase().replace(/@\w+$/, "");
    if (cmd === "/start") {
      if (arg) {
        const userId = await store.claimLinkCode(sql, arg, chat, message.from?.username ?? null);
        lang = await userLang(sql, userId, lang);
        await reply(botText(lang, userId ? "linked" : "badCode", { site }));
        return;
      }
      await reply(botText(lang, "welcome", { site }));
      return;
    }
    const userId = await store.userByChat(sql, chat);
    lang = await userLang(sql, userId, lang);
    if (cmd === "/help") return void (await reply(botText(lang, "help", { site })));
    if (cmd === "/paysupport") {
      const contact = process.env.PAY_CONTACT?.trim() || `${site}/trust`;
      return void (await reply(botText(lang, "paySupport", { site, contact: escapeHtml(contact) })));
    }
    if (cmd === "/stop") {
      await store.unlinkChat(sql, chat);
      return void (await reply(botText(lang, "stopped", { site })));
    }
    if (cmd === "/alerts") {
      if (!userId) return void (await reply(botText(lang, "notLinked", { site })));
      const alerts = (await store.listAlerts(sql, userId)).filter((a) => a.active);
      if (!alerts.length) return void (await reply(botText(lang, "noAlerts")));
      const lines = alerts.slice(0, 30).map((a) => `• <b>${escapeHtml(a.symbol)}</b> — ${alertLabel(lang, a)}`);
      return void (await reply([botText(lang, "alerts"), ...lines, "", `${site}/alerts`].join("\n")));
    }
    const ticker = TICKER.exec(text)?.[1]?.toUpperCase();
    if (!ticker) return void (await reply(botText(lang, "help", { site })));
    const [engine, { peekScan, runScan }] = await Promise.all([import("./alerts-engine.server"), import("./scan.server")]);
    const [coin] = await engine.coinsBySymbol([ticker]);
    if (!coin) return void (await reply(botText(lang, "unknown")));
    const scan = peekScan("1h");
    // A cold scan takes up to half a minute: answer with the price now, warm it for next time.
    if (!scan) void runScan("1h").catch(() => undefined);
    const tech = engine.techMap(scan).get(coin.symbol.toUpperCase()) ?? null;
    // The AI's call from the shared cache, if someone asked in the last 15 minutes — no new AI request.
    const { AI_CACHE_TTL, peekManyAi } = await import("./ai-cache.server");
    const sym = coin.symbol.toUpperCase();
    const keys = ["paid", "free"].map((tier) => `chart:${tier}:${sym}:1h:${lang}`);
    const found = await peekManyAi<{ direction: "LONG" | "SHORT" | "WAIT"; confidence: number }>(keys, AI_CACHE_TTL);
    const ai = keys.map((k) => found.get(k)).find(Boolean) ?? null;
    await reply(
      coinMessage(lang, { symbol: coin.symbol, name: coin.name, quote: engine.quoteOf(coin), tech, ai, url: `${site}/coins/${coin.id}` }),
    );
  } catch (err) {
    console.error("[telegram] update failed:", err instanceof Error ? err.message : err);
  }
}
