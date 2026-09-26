import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/shell";

/** Every public and member page shares the stats bar, header and footer. */
export const Route = createFileRoute("/_site")({
  component: () => (
    <SiteShell>
      <Outlet />
    </SiteShell>
  ),
});
