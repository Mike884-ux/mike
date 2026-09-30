import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { Brand, NAV } from "@/components/site/header";

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div className="max-w-sm">
          <Brand />
          <p className="mt-4 text-sm leading-relaxed text-muted">{t("footer.about")}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">{t("footer.products")}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-sm text-muted hover:text-fg">
                  {t(item.label)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/exchanges" className="inline-flex text-sm font-semibold text-primary hover:opacity-80">
              {t("ex.footer")}
            </Link>
            <Link to="/guide/candles" className="inline-flex text-sm font-semibold text-primary hover:opacity-80">
              {t("guide.footer")}
            </Link>
            <Link to="/trust" className="inline-flex text-sm font-semibold text-primary hover:opacity-80">
              {t("trust.link")}
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-1 px-4 py-5 text-[11px] leading-relaxed text-faint sm:px-6">
          <p>{t("footer.sources")}</p>
          <p>{t("common.disclaimer")}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/terms" className="hover:text-fg">{t("legal.terms")}</Link>
            <Link to="/privacy" className="hover:text-fg">{t("legal.privacy")}</Link>
            <Link to="/refund" className="hover:text-fg">{t("legal.refund")}</Link>
          </p>
          <p>
            © {new Date().getFullYear()} {t("app.name")}. {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
