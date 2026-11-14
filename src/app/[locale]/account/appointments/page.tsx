import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppointmentsView } from "@/components/appointments-view";
import { BookingUnavailable } from "@/components/booking-unavailable";
import { container } from "@/components/ui";
import { getFeatures } from "@/lib/features";
import { bookingAccess } from "@/lib/gates";
import { pageMetadata } from "@/lib/seo";

// Feature switches can change; keep the static page fresh.
export const revalidate = 60;

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

  if ((await bookingAccess()) !== "open") return <BookingUnavailable />;
  const { patientSelfService } = await getFeatures();

  return (
    <main className={`${container} py-10`}>
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>
      <AppointmentsView selfService={patientSelfService} />
    </main>
  );
}
