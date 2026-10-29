"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const other = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
    >
      {t("switchLanguage")}
    </Link>
  );
}
