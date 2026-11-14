import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BookingUnavailable } from "@/components/booking-unavailable";
import { DoctorAvatar } from "@/components/doctor-card";
import { ReviewsList } from "@/components/reviews-list";
import { RatingBadge } from "@/components/stars";
import { VideoBadge } from "@/components/video-join";
import { btnPrimary, card, container } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cityLabel } from "@/lib/cities";
import { ApiError } from "@/lib/api/errors";
import { getDoctor, getDoctorReviews, getDoctorSlots } from "@/lib/api/server";
import {
  addDays,
  formatDateKey,
  formatEgp,
  formatHHmm,
  formatPlain,
  todayInZone,
} from "@/lib/datetime";
import { catalogAccess, redirectToLogin } from "@/lib/gates";
import { getFeatures } from "@/lib/features";
import { orFallback } from "@/lib/safe";
import { buildDoctorJsonLd, pageMetadata, serializeJsonLd } from "@/lib/seo";

async function loadDoctor(locale: string, slug: string) {
  try {
    return await getDoctor(locale, slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    // The session expired while guest browsing is off.
    if (error instanceof ApiError && error.status === 401) redirectToLogin(locale);
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/doctors/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "Profile" });
  if ((await catalogAccess()) !== "open") {
    const gate = await getTranslations({ locale, namespace: "Gate" });
    return pageMetadata({
      locale,
      path: `/doctors/${slug}`,
      title: gate("metaTitle"),
      description: gate("metaTitle"),
      noIndex: true,
    });
  }
  const doctor = await loadDoctor(locale, slug);
  return pageMetadata({
    locale,
    path: `/doctors/${doctor.slug}`,
    title: t("metaTitle", {
      name: doctor.name,
      specialty: doctor.specialty.name,
      city: cityLabel(doctor.clinic.city, locale),
    }),
    description: t("metaDescription", {
      name: doctor.name,
      specialty: doctor.specialty.name,
      clinic: doctor.clinic.name,
      city: cityLabel(doctor.clinic.city, locale),
    }),
    image: doctor.photoUrl,
  });
}

export default async function DoctorProfilePage({
  params,
}: PageProps<"/[locale]/doctors/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Profile" });
  const common = await getTranslations({ locale, namespace: "Common" });
  const doctors = await getTranslations({ locale, namespace: "Doctors" });

  const access = await catalogAccess();
  if (access === "unavailable") return <BookingUnavailable />;
  if (access === "login") redirectToLogin(locale);
  const features = await getFeatures();
  const { multiBranch } = features;

  const doctorData = await loadDoctor(locale, slug);
  // The API already omits phase-2 fields for a switched-off feature; this keeps the page honest if it does not.
  const doctor = {
    ...doctorData,
    rating: features.reviews ? doctorData.rating : null,
    offersVideo: features.videoConsultation && Boolean(doctorData.offersVideo),
    insuranceProviders: features.insurance ? (doctorData.insuranceProviders ?? []) : [],
  };
  const { clinic } = doctor;
  const reviews = features.reviews && doctor.rating
    ? await orFallback(getDoctorReviews(locale, doctor.slug), null)
    : null;
  const reviewsT = await getTranslations({ locale, namespace: "Reviews" });
  const video = await getTranslations({ locale, namespace: "Video" });

  const today = todayInZone(clinic.timezone);
  const slots = await orFallback(
    getDoctorSlots(locale, doctor.slug, today, addDays(today, 13)),
    null,
  );
  const next = slots?.days.find((day) => day.slots.length > 0);
  const nextSlot = next?.slots[0];

  const mapsHref =
    clinic.latitude != null && clinic.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${clinic.latitude},${clinic.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clinic.name} ${clinic.address}`)}`;

  return (
    <main className={`${container} py-10`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildDoctorJsonLd(doctor, locale)),
        }}
      />

      <nav aria-label="breadcrumb" className="mb-6 text-sm text-muted">
        <Link href="/doctors" className="hover:underline">
          {t("breadcrumbDoctors")}
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{doctor.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <DoctorAvatar
              name={doctor.name}
              photoUrl={doctor.photoUrl}
              alt={doctors("photoAlt", { name: doctor.name })}
              size="size-28"
            />
            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold">{doctor.name}</h1>
              <p className="text-lg font-medium text-accent">{doctor.specialty.name}</p>
              <p className="text-muted">
                {multiBranch ? `${clinic.name} — ${cityLabel(clinic.city, locale)}` : clinic.name}
              </p>
              {doctor.rating || doctor.offersVideo ? (
                <p className="flex flex-wrap items-center gap-3 pt-1">
                  <RatingBadge rating={doctor.rating} />
                  {doctor.offersVideo ? <VideoBadge /> : null}
                </p>
              ) : null}
            </div>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-bold">{t("about")}</h2>
            <p className="max-w-prose whitespace-pre-line text-muted">
              {doctor.bio || t("noBio")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t("services")}</h2>
            {doctor.services.length === 0 ? (
              <p className="text-muted">{t("noServices")}</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {doctor.services.map((service) => (
                  <li
                    key={service.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <span className="font-medium">{service.name}</span>
                    <span className="text-sm text-muted">
                      {common("minutes", { count: formatPlain(service.durationMinutes, locale) })}
                      {service.priceEgp != null
                        ? ` — ${formatEgp(service.priceEgp, locale)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-muted">{t("servicesHint")}</p>
          </section>

          {doctor.insuranceProviders.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-bold">{t("insurance")}</h2>
              <ul className="flex flex-wrap gap-2">
                {doctor.insuranceProviders.map((p) => (
                  <li key={p.id} className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium">
                    {p.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {doctor.offersVideo ? (
            <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{video("profileNote")}</p>
          ) : null}

          {features.reviews ? (
            <section className="space-y-3" id="reviews">
              <h2 className="text-xl font-bold">{reviewsT("title")}</h2>
              {reviews && reviews.items.length > 0 ? (
                <ReviewsList doctorSlug={doctor.slug} initial={reviews} />
              ) : (
                <p className="text-muted">{reviewsT("empty")}</p>
              )}
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t("clinic")}</h2>
            <dl className={`${card} grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-x-6`}>
              <dt className="font-medium text-muted">{t("address")}</dt>
              <dd>
                {clinic.address}
                <br />
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t("directions")}
                </a>
              </dd>
              <dt className="font-medium text-muted">{t("phone")}</dt>
              <dd>
                <a href={`tel:${clinic.phone}`} dir="ltr" className="hover:underline">
                  {clinic.phone}
                </a>
              </dd>
            </dl>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className={`${card} space-y-4`}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {doctor.yearsExperience ? (
                <div>
                  <p className="text-muted">{t("experience")}</p>
                  <p className="font-bold">
                    {doctors("yearsExperience", {
                      count: doctor.yearsExperience,
                      n: formatPlain(doctor.yearsExperience, locale),
                    })}
                  </p>
                </div>
              ) : null}
              {doctor.consultationFeeEgp != null ? (
                <div>
                  <p className="text-muted">{t("fee")}</p>
                  <p className="font-bold">{formatEgp(doctor.consultationFeeEgp, locale)}</p>
                </div>
              ) : null}
            </div>
            <p className="text-xs text-muted">{t("feeNote")}</p>

            <div className="rounded-xl bg-surface-muted p-3 text-sm">
              <p className="font-semibold">{t("availability")}</p>
              {next && nextSlot ? (
                <p className="text-muted">
                  {t("nextAvailable")}: {formatDateKey(next.date, locale)},{" "}
                  {formatHHmm(nextSlot.local, locale)}
                </p>
              ) : (
                <p className="text-muted">{t("noAvailability")}</p>
              )}
            </div>

            <Link
              href={`/doctors/${doctor.slug}/book`}
              className={`${btnPrimary} w-full`}
            >
              {t("bookCta")}
            </Link>
            <p className="text-center text-xs text-muted">{t("bookCtaHint")}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
