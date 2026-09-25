import { useState } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import appCss from "../styles.css?url";

const APP_NAME = "Скан";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#060912" },
      { name: "description", content: "Скан рынка по 100 монетам и акциям: сигнал по 8 индикаторам, проверка на истории и разбор ИИ." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            // Never retry a signed-out request: each retry kept the screen in a
            // loading state for seconds before showing the login page.
            retry: (count, error) => !(error instanceof Error && /unauthori[sz]ed/i.test(error.message)) && count < 2,
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
