import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="text-lg opacity-80">{t("subtitle")}</p>
    </main>
  );
}
