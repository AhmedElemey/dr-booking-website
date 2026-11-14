import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppointmentDetail } from "@/components/appointment-detail";
import { BookingUnavailable } from "@/components/booking-unavailable";
import { container } from "@/components/ui";
import { getFeatures } from "@/lib/features";
import { bookingAccess } from "@/lib/gates";
import { parsePaymentReturn } from "@/lib/payments";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/appointments/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return pageMetadata({
    locale,
    path: `/appointments/${id}`,
    title: t("detailMetaTitle"),
    description: t("detailMetaTitle"),
    noIndex: true,
  });
}

/** One appointment; the online-payment checkout sends the patient back here with `?payment=return`. */
export default async function AppointmentPage({
  params,
  searchParams,
}: PageProps<"/[locale]/appointments/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Account" });

  if ((await bookingAccess()) !== "open") return <BookingUnavailable />;
  const features = await getFeatures();

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, item);
    }
  }

  return (
    <main className={`${container} py-10`}>
      <h1 className="mb-6 text-3xl font-bold">{t("detailTitle")}</h1>
      <AppointmentDetail
        id={id}
        selfService={features.patientSelfService}
        features={features}
        paymentReturn={parsePaymentReturn(query)}
      />
    </main>
  );
}
