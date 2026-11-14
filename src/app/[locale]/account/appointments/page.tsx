import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppointmentsView } from "@/components/appointments-view";
import { container } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/appointments">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return pageMetadata({
    locale,
    path: "/account/appointments",
    title: t("metaTitle"),
    description: t("metaTitle"),
    noIndex: true,
  });
}

export default async function AccountAppointmentsPage({
  params,
}: PageProps<"/[locale]/account/appointments">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Account" });

  return (
    <main className={`${container} py-10`}>
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>
      <AppointmentsView />
    </main>
  );
}
