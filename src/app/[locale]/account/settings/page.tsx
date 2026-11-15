import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccountNav } from "@/components/account-nav";
import { BookingUnavailable } from "@/components/booking-unavailable";
import { SettingsView } from "@/components/settings-view";
import { container } from "@/components/ui";
import { hasSettings } from "@/lib/account";
import { getFeatures } from "@/lib/features";
import { bookingAccess } from "@/lib/gates";
import { pageMetadata } from "@/lib/seo";

// Feature switches can change; keep the static page fresh.
export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return pageMetadata({
    locale,
    path: "/account/settings",
    title: t("metaTitle"),
    description: t("metaTitle"),
    noIndex: true,
  });
}

export default async function AccountSettingsViewPage({
  params,
}: PageProps<"/[locale]/account/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Settings" });

  if ((await bookingAccess()) !== "open") return <BookingUnavailable />;
  const features = await getFeatures();
  if (!(hasSettings(features))) notFound();

  return (
    <main className={`${container} py-10`}>
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>
      <AccountNav features={features} />
      <SettingsView features={features} />
    </main>
  );
}
