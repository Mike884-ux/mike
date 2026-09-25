# Скан

Сканер рынка: около 100 монет и акций сразу, сигнал по индикаторам, график, разбор с ИИ, кошелёк, новости и чат.

## Запустить свой сайт

Нажмите кнопку, войдите в Vercel через GitHub и нажмите **Deploy**:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMike884-ux%2Fmike&project-name=scan&repository-name=scan&env=BETTER_AUTH_SECRET&envDescription=%D0%9B%D1%8E%D0%B1%D0%B0%D1%8F%20%D0%B4%D0%BB%D0%B8%D0%BD%D0%BD%D0%B0%D1%8F%20%D1%81%D0%BB%D1%83%D1%87%D0%B0%D0%B9%D0%BD%D0%B0%D1%8F%20%D1%81%D1%82%D1%80%D0%BE%D0%BA%D0%B0%2C%2032%2B%20%D1%81%D0%B8%D0%BC%D0%B2%D0%BE%D0%BB%D0%B0&envLink=https%3A%2F%2Fgithub.com%2FMike884-ux%2Fmike%23%D0%BF%D0%B5%D1%80%D0%B5%D0%BC%D0%B5%D0%BD%D0%BD%D1%8B%D0%B5-%D0%BE%D0%BA%D1%80%D1%83%D0%B6%D0%B5%D0%BD%D0%B8%D1%8F)

Через пару минут Vercel покажет адрес вида `https://scan-xxxx.vercel.app`. Это и есть ваш сайт.

## Переменные окружения

Задаются в Vercel: Project → Settings → Environment Variables. После изменения нажмите Redeploy.

| Переменная | Обязательна | Зачем |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | да | Подпись сессий. Любая случайная строка от 32 символов. Без неё все выходят из аккаунта при каждом перезапуске. |
| `DATABASE_URL` | для постоянных аккаунтов | Строка подключения Postgres. Бесплатно: Vercel → Storage → Neon. Без неё база временная и аккаунты теряются. |
| `GEMINI_API_KEY` | для ИИ | Ключ Google AI Studio. Без него кнопки ИИ отвечают «ИИ недоступен», остальное работает. |
| `ANTHROPIC_API_KEY` | нет | Запасной ИИ, если Gemini не ответил. |
| `APP_HOSTS` | нет | Свой домен, например `scan.example.com`. Адреса `*.vercel.app` подхватываются сами. |

## Локальный запуск

```bash
npm install
npm run dev      # http://localhost:8090
npm test         # тесты индикаторов и расчётов портфеля
npm run lint
npm run typecheck
```

Без `DATABASE_URL` локально используется встроенная база в папке `.data/`.

Это не инвестиционная рекомендация.
