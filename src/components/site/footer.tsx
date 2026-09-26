import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { Brand, NAV } from "@/components/site/header";

const SOURCES = [
  { name: "CoinGecko", href: "https://www.coingecko.com/" },
  { name: "Binance", href: "https://www.binance.com/" },
  { name: "CoinPaprika", href: "https://coinpaprika.com/" },
  { name: "Alternative.me", href: "https://alternative.me/crypto/fear-and-greed-index/" },
];

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Brand />
          <p className="mt-4 text-sm leading-relaxed text-muted">{t("footer.about")}</p>
          <p className="mt-3 text-xs leading-relaxed text-faint">{t("common.disclaimer")}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">{t("footer.products")}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-sm text-muted hover:text-fg">
                  {t(item.label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">{t("footer.data")}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {SOURCES.map((source) => (
              <li key={source.name}>
                <a href={source.href} target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-fg">
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">{t("footer.poweredBy")}</p>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-[1440px] px-4 py-5 text-xs text-faint sm:px-6">
          © {new Date().getFullYear()} {t("app.name")}. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
