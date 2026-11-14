import { useTranslations } from "next-intl";

import { btnPrimary, container } from "@/components/ui";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("ErrorPage");

  return (
    <main className={`${container} flex flex-1 flex-col items-start gap-4 py-20`}>
      <h1 className="text-3xl font-bold">{t("notFoundTitle")}</h1>
      <p className="text-muted">{t("notFoundText")}</p>
      <Link href="/" className={btnPrimary}>
        {t("goHome")}
      </Link>
    </main>
  );
}
