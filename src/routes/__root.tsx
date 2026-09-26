import { useState } from "react";
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MarketError } from "@/lib/coins";
import { useT } from "@/lib/i18n";
import { THEME_BOOT_SCRIPT } from "@/lib/settings-store";
import { Container, SiteShell } from "@/components/site/shell";
import appCss from "../styles.css?url";

const APP_NAME = "Скан";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${APP_NAME} — цены криптовалют, капитализация и сигналы` },
      { name: "theme-color", content: "#ffffff" },
      {
        name: "description",
        content: "Цены, рыночная капитализация и графики криптовалют в реальном времени, сигналы по индикаторам и разбор рынка от ИИ.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
    scripts: [{ children: THEME_BOOT_SCRIPT }],
  }),
  component: RootDocument,
  notFoundComponent: NotFound,
});

function NotFound() {
  const t = useT();
  return (
    <SiteShell>
      <Container className="py-24 text-center">
        <p className="font-display text-6xl font-bold text-faint">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-fg">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("notFound.text")}</p>
        <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-fg">
          {t("coin.backToList")}
        </Link>
      </Container>
    </SiteShell>
  );
}

function RootDocument() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            // Never retry a signed-out request or a missing coin: each retry kept
            // the screen in a loading state for seconds before showing the answer.
            retry: (count, error) =>
              !(error instanceof Error && /unauthori[sz]ed/i.test(error.message)) &&
              !(error instanceof MarketError && (error.status === 404 || error.status === 429)) &&
              count < 2,
            retryDelay: (attempt) => Math.min(600 * 2 ** attempt, 3000),
          },
        },
      }),
  );

  return (
    <html lang="ru" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="text-fg">
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
