import { createFileRoute } from "@tanstack/react-router";
import { MAX_PAGES } from "@/lib/coins";
import { asHomeTab, HomePage, type HomeTab } from "@/components/market/home-page";

type HomeSearch = { page?: number; tab?: HomeTab };

export const Route = createFileRoute("/_site/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const page = Math.floor(Number(search.page));
    const tab = asHomeTab(search.tab);
    return {
      page: page > 1 && page <= MAX_PAGES ? page : undefined,
      tab: tab === "all" ? undefined : tab,
    };
  },
  component: Home,
});

function Home() {
  const { page, tab } = Route.useSearch();
  return <HomePage page={page ?? 1} tab={tab ?? "all"} />;
}
