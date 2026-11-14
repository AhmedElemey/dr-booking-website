import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { formatPlain } from "@/lib/datetime";

import { MoonMark } from "./logo";

export function SiteFooter() {
  const t = useTranslations("Footer");
  const locale = useLocale();
  const nav = useTranslations("Nav");
  const brand = useTranslations("Common")("brand");

  return (
    <footer className="mt-16 bg-night text-night-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-lg font-bold">
            <MoonMark />
            {brand}
          </div>
          <p className="max-w-xs text-sm opacity-75">{t("tagline")}</p>
          <p className="max-w-xs text-sm opacity-60">{t("forClinics")}</p>
        </div>

        <FooterColumn title={t("explore")}>
          <Link href="/doctors">{nav("doctors")}</Link>
          <Link href="/account/appointments">{nav("myAppointments")}</Link>
        </FooterColumn>

        <FooterColumn title={t("company")}>
          <Link href="/about">{nav("about")}</Link>
          <Link href="/contact">{nav("contact")}</Link>
        </FooterColumn>

        <FooterColumn title={t("legal")}>
          <Link href="/terms">{t("terms")}</Link>
          <Link href="/privacy">{t("privacy")}</Link>
        </FooterColumn>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs opacity-60">
        {t("rights", { year: formatPlain(new Date().getFullYear(), locale) })}
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold opacity-90">{title}</h2>
      <div className="flex flex-col gap-2 text-sm opacity-75 [&_a:hover]:underline">
        {children}
      </div>
    </div>
  );
}
