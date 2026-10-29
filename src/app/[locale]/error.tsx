"use client";

import { useTranslations } from "next-intl";

import { btnPrimary, container } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("ErrorPage");
  const common = useTranslations("Common");

  return (
    <main className={`${container} flex flex-1 flex-col items-start gap-4 py-20`}>
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="text-muted">{t("text")}</p>
      <button type="button" onClick={reset} className={btnPrimary}>
        {common("retry")}
      </button>
    </main>
  );
}
