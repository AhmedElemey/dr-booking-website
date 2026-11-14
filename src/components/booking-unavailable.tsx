import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { clinicConfig, dialablePhone } from "@/lib/clinic-config";

import { btnPrimary, btnSecondary, container } from "./ui";

/** Shown instead of booking, search, doctor and appointment pages while the website feature is off. */
export function BookingUnavailable() {
  const t = useTranslations("Gate");
  const phone = clinicConfig.supportPhone;

  return (
    <main className={`${container} flex max-w-2xl flex-1 flex-col items-start gap-4 py-20`}>
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="text-lg text-muted">{t("text", { phone })}</p>
      <div className="flex flex-wrap gap-3">
        <a href={`tel:${dialablePhone(phone)}`} dir="ltr" className={btnPrimary}>
          {t("call", { phone })}
        </a>
        <Link href="/" className={btnSecondary}>
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
