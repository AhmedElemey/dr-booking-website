import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BookingFlow } from "@/components/booking-flow";
import { BookingUnavailable } from "@/components/booking-unavailable";
import { DoctorAvatar } from "@/components/doctor-card";
import { container } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import { getDoctor } from "@/lib/api/server";
import { getFeatures } from "@/lib/features";
import { bookingAccess } from "@/lib/gates";
import { pageMetadata } from "@/lib/seo";

async function loadDoctor(locale: string, slug: string) {
  try {
    return await getDoctor(locale, slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/doctors/[slug]/book">): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "Booking" });
  if ((await bookingAccess()) !== "open") {
    const gate = await getTranslations({ locale, namespace: "Gate" });
    return pageMetadata({
      locale,
      path: `/doctors/${slug}/book`,
      title: gate("metaTitle"),
      description: gate("metaTitle"),
      noIndex: true,
    });
  }
  const doctor = await loadDoctor(locale, slug);
  return pageMetadata({
    locale,
    path: `/doctors/${doctor.slug}/book`,
    title: t("metaTitle", { name: doctor.name }),
    description: t("metaTitle", { name: doctor.name }),
    noIndex: true,
  });
}

export default async function BookPage({
  params,
}: PageProps<"/[locale]/doctors/[slug]/book">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Booking" });
  const doctors = await getTranslations({ locale, namespace: "Doctors" });
  if ((await bookingAccess()) !== "open") return <BookingUnavailable />;
  const doctor = await loadDoctor(locale, slug);
  const features = await getFeatures();

  return (
    <main className={`${container} py-10`}>
      <header className="mb-8 flex items-center gap-4">
        <DoctorAvatar
          name={doctor.name}
          photoUrl={doctor.photoUrl}
          alt={doctors("photoAlt", { name: doctor.name })}
          size="size-16"
        />
        <div>
          <h1 className="text-2xl font-extrabold">{t("title", { name: doctor.name })}</h1>
          <p className="text-muted">
            <Link href={`/doctors/${doctor.slug}`} className="hover:underline">
              {doctor.specialty.name}
            </Link>{" "}
            — {doctor.clinic.name}
          </p>
        </div>
      </header>
      <BookingFlow doctor={doctor} features={features} />
    </main>
  );
}
