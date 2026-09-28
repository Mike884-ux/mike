import { createFileRoute } from "@tanstack/react-router";
import { PRESET_IDS, type PresetId } from "@/lib/screener";
import { ScreenerPage } from "@/components/market/screener-page";

type ScreenerSearch = { preset?: PresetId };

export const Route = createFileRoute("/_site/screener")({
  validateSearch: (search: Record<string, unknown>): ScreenerSearch => {
    const preset = PRESET_IDS.find((id) => id === search.preset);
    return preset ? { preset } : {};
  },
  head: () => ({ meta: [{ title: "Крипто-скринер — Скан" }] }),
  component: Page,
});

function Page() {
  const { preset } = Route.useSearch();
  return <ScreenerPage key={preset ?? "all"} preset={preset} />;
}
