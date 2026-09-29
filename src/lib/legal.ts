/**
 * The site's legal documents in Russian and English. A plain template for the
 * owner to read and adjust: no company details are invented — the contact is
 * the support address from PAY_CONTACT.
 */
import type { Lang } from "./lang";

export const LEGAL_DOCS = ["privacy", "terms", "refund"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

export type LegalText = {
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: { h: string; p: string[] }[];
};

const UPDATED = { ru: "Редакция от 29 сентября 2026 года", en: "Last updated: September 29, 2026" };

export const LEGAL: Record<LegalDoc, Record<Lang, LegalText>> = {
  privacy: {
    ru: {
      title: "Политика конфиденциальности",
      description: "Какие данные собирает сайт Скан, зачем, кому они передаются и как их удалить.",
      updated: UPDATED.ru,
      intro: "Эта политика объясняет, какие данные о вас хранит сайт «Скан» (далее — «мы», «сайт»), зачем они нужны и как ими управлять. Пользуясь сайтом, вы соглашаетесь с этой политикой.",
      sections: [
        {
          h: "Какие данные мы храним",
          p: [
            "Данные аккаунта: адрес электронной почты, имя, зашифрованный (хэшированный) пароль или данные входа через Google или X.",
            "То, что вы сами добавляете: сделки и портфель, избранные монеты, сохранённые фильтры, уведомления, язык, страну и тему оформления.",
            "Если вы подключили Telegram-бота — идентификатор чата, чтобы присылать уведомления.",
            "Технические данные: IP-адрес и сведения о браузере — для входа в аккаунт, защиты от злоупотреблений и ограничения частоты запросов.",
            "Сведения об оплатах: тариф, сумма, статус и идентификатор платежа. Данные банковских карт мы не получаем и не храним — их обрабатывают платёжные сервисы.",
          ],
        },
        {
          h: "Зачем они нужны",
          p: [
            "Чтобы вы могли войти в аккаунт, вести портфель и получать уведомления; чтобы работали тарифы и лимиты; чтобы защищать сайт от ботов и мошенничества; чтобы отвечать на ваши обращения.",
            "Мы не продаём ваши данные и не показываем чужую рекламу по ним.",
          ],
        },
        {
          h: "Кому передаются данные",
          p: [
            "Только сервисам, без которых сайт не работает: хостинг (Render), база данных (Neon), отправка писем (Resend), вход через Google или X, Telegram — для уведомлений.",
            "Вопросы в чат и данные для разбора монеты отправляются ИИ-провайдеру (Anthropic) для получения ответа. Не пишите в чат пароли, номера карт и другие секреты.",
            "Платёжные сервисы (Dodo Payments, NOWPayments, Stripe) получают то, что нужно для оплаты, по своим правилам.",
            "Рыночные данные мы берём у открытых источников (CoinGecko, Binance и других) — ваши личные данные туда не передаются.",
          ],
        },
        {
          h: "Cookies и хранилище браузера",
          p: [
            "Мы используем cookie сессии, чтобы вы оставались в аккаунте, и хранилище браузера — для настроек (язык, тема, выбранная биржа). Рекламных и сторонних отслеживающих cookie на сайте нет.",
          ],
        },
        {
          h: "Сколько мы храним данные",
          p: [
            "Пока существует ваш аккаунт. Технические журналы — не дольше, чем нужно для защиты сайта. Сведения об оплатах храним столько, сколько требуют правила учёта.",
          ],
        },
        {
          h: "Ваши права",
          p: [
            "Вы можете попросить показать, исправить или удалить ваши данные и аккаунт — напишите в поддержку с адреса, привязанного к аккаунту. Ответим в течение 30 дней.",
            "Сайт предназначен для людей старше 18 лет.",
          ],
        },
        {
          h: "Изменения политики",
          p: ["Если политика изменится, мы обновим дату редакции на этой странице. Существенные изменения объявим на сайте."],
        },
      ],
    },
    en: {
      title: "Privacy Policy",
      description: "What data Scan collects, why, who it is shared with and how to delete it.",
      updated: UPDATED.en,
      intro: "This policy explains what data the Scan website (“we”, “the site”) keeps about you, why, and how you can control it. By using the site you agree to this policy.",
      sections: [
        {
          h: "What we store",
          p: [
            "Account data: email address, name, a hashed password or your Google or X sign-in details.",
            "What you add yourself: trades and portfolio, favourite coins, saved screens, alerts, language, country and theme.",
            "If you connect the Telegram bot — the chat ID, to send you alerts.",
            "Technical data: IP address and browser details — for sign-in, abuse protection and rate limiting.",
            "Payment records: plan, amount, status and payment ID. We never receive or store card details — payment providers handle them.",
          ],
        },
        {
          h: "Why",
          p: [
            "To let you sign in, keep a portfolio and get alerts; to run plans and limits; to protect the site from bots and fraud; to answer your requests.",
            "We don't sell your data or use it for third-party ads.",
          ],
        },
        {
          h: "Who we share it with",
          p: [
            "Only services the site needs to work: hosting (Render), database (Neon), email (Resend), Google or X sign-in, and Telegram for alerts.",
            "Chat questions and coin data for analysis are sent to the AI provider (Anthropic) to get an answer. Don't type passwords, card numbers or other secrets into the chat.",
            "Payment providers (Dodo Payments, NOWPayments, Stripe) receive what they need for the payment, under their own terms.",
            "Market data comes from public sources (CoinGecko, Binance and others) — no personal data is sent to them.",
          ],
        },
        {
          h: "Cookies and browser storage",
          p: ["We use a session cookie to keep you signed in and browser storage for settings (language, theme, chosen exchange). There are no advertising or third-party tracking cookies."],
        },
        {
          h: "How long we keep data",
          p: ["As long as your account exists. Technical logs no longer than needed to protect the site. Payment records as long as accounting rules require."],
        },
        {
          h: "Your rights",
          p: [
            "You can ask us to show, correct or delete your data and account — write to support from the address linked to your account. We reply within 30 days.",
            "The site is intended for people aged 18 and over.",
          ],
        },
        {
          h: "Changes",
          p: ["If this policy changes, we update the date on this page. Significant changes are announced on the site."],
        },
      ],
    },
  },
  terms: {
    ru: {
      title: "Условия использования",
      description: "Правила пользования сайтом Скан: что это за сервис, тарифы, ограничения и ответственность.",
      updated: UPDATED.ru,
      intro: "Эти условия — договор между вами и владельцем сайта «Скан». Регистрируясь или пользуясь сайтом, вы их принимаете. Если вы не согласны — пожалуйста, не пользуйтесь сайтом.",
      sections: [
        {
          h: "Что такое Скан",
          p: [
            "Скан — информационный сервис: цены и графики криптовалют, скринер, уведомления и разборы с помощью искусственного интеллекта.",
            "Ничто на сайте не является инвестиционной, финансовой или налоговой рекомендацией. Решения о сделках вы принимаете сами и сами несёте за них ответственность.",
            "Ответы ИИ могут быть неточными или устаревшими. Рыночные данные поступают от сторонних источников и могут приходить с задержкой.",
          ],
        },
        {
          h: "Аккаунт",
          p: [
            "Вам должно быть не меньше 18 лет. Указывайте настоящий адрес почты и храните пароль в секрете — за действия в аккаунте отвечаете вы.",
            "Один человек — один аккаунт. Пробный Pro предоставляется один раз.",
          ],
        },
        {
          h: "Тарифы и оплата",
          p: [
            "Платные тарифы (Pro, Whale) оплачиваются разово за выбранный срок — месяц или год. Автоматического продления и списаний нет.",
            "У каждого тарифа есть дневные лимиты и ИИ-кредиты, они указаны на странице «Тарифы». Цены могут меняться, но уже оплаченный срок остаётся на прежних условиях.",
            "Возврат денег — по «Политике возврата».",
          ],
        },
        {
          h: "Партнёрские ссылки",
          p: [
            "Часть ссылок на биржи — партнёрские: биржа может заплатить нам за приглашённого пользователя. Для вас условия и комиссии бирж от этого не меняются. Биржи — самостоятельные компании, их услуги регулируются их собственными правилами.",
          ],
        },
        {
          h: "Что запрещено",
          p: [
            "Автоматический сбор данных (парсинг), боты и скрипты, обход лимитов и защиты, создание нескольких аккаунтов ради пробного периода, перепродажа доступа, попытки взлома и нагрузка, мешающая работе сайта.",
            "При нарушении мы можем ограничить или закрыть доступ без возврата оплаты за нарушенный срок.",
          ],
        },
        {
          h: "Ответственность",
          p: [
            "Сайт предоставляется «как есть». Мы стараемся, чтобы он работал без перебоев, но не гарантируем точность данных и отсутствие ошибок.",
            "Мы не отвечаем за убытки от торговых решений, работы бирж и сторонних сервисов. В любом случае наша ответственность ограничена суммой, которую вы заплатили нам за последние 3 месяца.",
          ],
        },
        {
          h: "Изменения и связь",
          p: [
            "Мы можем обновлять эти условия; новая редакция действует с даты, указанной на странице. Вопросы — в поддержку.",
          ],
        },
      ],
    },
    en: {
      title: "Terms of Use",
      description: "The rules for using Scan: what the service is, plans, restrictions and liability.",
      updated: UPDATED.en,
      intro: "These terms are an agreement between you and the owner of the Scan website. By signing up or using the site you accept them. If you don't agree, please don't use the site.",
      sections: [
        {
          h: "What Scan is",
          p: [
            "Scan is an information service: crypto prices and charts, a screener, alerts and AI-assisted analysis.",
            "Nothing on the site is investment, financial or tax advice. You make your own trading decisions and are responsible for them.",
            "AI answers may be inaccurate or outdated. Market data comes from third parties and may be delayed.",
          ],
        },
        {
          h: "Your account",
          p: [
            "You must be at least 18. Use a real email address and keep your password secret — you are responsible for activity in your account.",
            "One person, one account. The Pro trial is given once.",
          ],
        },
        {
          h: "Plans and payment",
          p: [
            "Paid plans (Pro, Whale) are paid once for the chosen period — a month or a year. There is no automatic renewal or recurring charge.",
            "Each plan has daily limits and AI credits, listed on the Pricing page. Prices may change, but a period you already paid for keeps its terms.",
            "Refunds follow the Refund Policy.",
          ],
        },
        {
          h: "Partner links",
          p: ["Some exchange links are partner links: the exchange may pay us for a referred user. Your terms and fees at the exchange don't change. Exchanges are independent companies governed by their own rules."],
        },
        {
          h: "What is not allowed",
          p: [
            "Scraping, bots and scripts, bypassing limits or protection, multiple accounts to reuse the trial, reselling access, hacking attempts and load that disrupts the site.",
            "If you break these rules we may limit or close your access without a refund for the affected period.",
          ],
        },
        {
          h: "Liability",
          p: [
            "The site is provided “as is”. We work to keep it running, but don't guarantee the data is accurate or error-free.",
            "We are not liable for losses from trading decisions, exchanges or third-party services. In any case our liability is limited to what you paid us in the last 3 months.",
          ],
        },
        {
          h: "Changes and contact",
          p: ["We may update these terms; the new version applies from the date shown on this page. Questions — contact support."],
        },
      ],
    },
  },
  refund: {
    ru: {
      title: "Политика возврата",
      description: "Когда и как Скан возвращает деньги за тариф Pro или Whale.",
      updated: UPDATED.ru,
      intro: "Мы хотим, чтобы вы платили только за то, что работает. Вот когда мы возвращаем деньги за тариф.",
      sections: [
        {
          h: "Пробный период",
          p: ["Пробный Pro бесплатный — деньги не списываются, возвращать нечего. После окончания пробного периода аккаунт просто переходит на бесплатный тариф."],
        },
        {
          h: "Когда мы вернём деньги",
          p: [
            "В течение 7 дней после оплаты, если платные функции не работают по нашей вине и мы не смогли это исправить.",
            "В течение 7 дней после оплаты, если вы оплатили по ошибке (например, дважды или не тот тариф) и сделали меньше 10 запросов к ИИ.",
          ],
        },
        {
          h: "Когда возврат не делается",
          p: [
            "Если срок тарифа уже в основном использован, если тариф закрыт за нарушение «Условий использования», а также за недовольство результатами сделок — сайт не даёт гарантий прибыли.",
          ],
        },
        {
          h: "Как попросить возврат",
          p: [
            "Напишите в поддержку с адреса вашего аккаунта и укажите номер платежа (он есть в письме или в истории оплат). Мы ответим и, если возврат положен, вернём деньги в течение 5 рабочих дней.",
            "Оплата картой возвращается на ту же карту. Оплата криптовалютой — той же монетой на указанный вами адрес, за вычетом сетевой комиссии.",
            "После возврата платный тариф отключается.",
          ],
        },
      ],
    },
    en: {
      title: "Refund Policy",
      description: "When and how Scan refunds a Pro or Whale plan.",
      updated: UPDATED.en,
      intro: "We want you to pay only for what works. Here is when we refund a plan.",
      sections: [
        {
          h: "Trial",
          p: ["The Pro trial is free — nothing is charged, so there is nothing to refund. When it ends, the account simply moves to the free plan."],
        },
        {
          h: "When we refund",
          p: [
            "Within 7 days of payment, if paid features don't work because of us and we couldn't fix it.",
            "Within 7 days of payment, if you paid by mistake (for example twice, or the wrong plan) and made fewer than 10 AI requests.",
          ],
        },
        {
          h: "When we don't",
          p: ["When most of the plan period has been used, when the plan was closed for breaking the Terms of Use, or over trading results — the site doesn't promise profits."],
        },
        {
          h: "How to ask",
          p: [
            "Write to support from your account's email and include the payment ID (in the email or your payment history). If a refund is due, we return the money within 5 business days.",
            "Card payments go back to the same card. Crypto payments go back in the same coin to the address you give, minus the network fee.",
            "After a refund the paid plan is switched off.",
          ],
        },
      ],
    },
  },
};
