import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { LanguageSwitcher } from "./language-switcher";
import { MoonMark } from "./logo";

export function SiteHeader() {
  const t = useTranslations("Nav");
  const brand = useTranslations("Common")("brand");

  const links = [
    { href: "/doctors", label: t("doctors") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          aria-label={t("home")}
          className="flex items-center gap-2 text-lg font-bold"
        >
          <MoonMark />
          <span>{brand}</span>
        </Link>

        <nav
          aria-label={t("mainNavigation")}
          className="order-last flex w-full items-center gap-5 overflow-x-auto text-sm font-medium sm:order-none sm:w-auto sm:flex-1"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap py-1 text-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2 sm:ms-0">
          <Link
            href="/account/appointments"
            className="rounded-full bg-surface-muted px-4 py-2 text-sm font-semibold hover:bg-border"
          >
            {t("myAppointments")}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
