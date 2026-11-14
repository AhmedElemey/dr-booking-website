import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cityLabel } from "@/lib/cities";
import { formatEgp, formatPlain } from "@/lib/datetime";
import type { DoctorSummary } from "@/lib/api/types";
import type { Features } from "@/lib/features";

import { RatingBadge } from "./stars";
import { btnPrimary, btnSecondary, card } from "./ui";
import { VideoBadge } from "./video-join";

export function DoctorAvatar({
  name,
  photoUrl,
  alt,
  size = "size-20",
}: {
  name: string;
  photoUrl?: string | null;
  alt: string;
  size?: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photo hosts are configured per environment by the API
      <img
        src={photoUrl}
        alt={alt}
        width={96}
        height={96}
        loading="lazy"
        className={`${size} shrink-0 rounded-2xl object-cover`}
      />
    );
  }
  const initials = name
    .replace(/^(Dr\.?|د\.?)\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
  return (
    <div
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-2xl font-bold text-accent`}
    >
      {initials}
    </div>
  );
}

export function DoctorCard({
  doctor,
  features = {},
}: {
  doctor: DoctorSummary;
  /** Ratings, the video badge and accepted insurers show only while their switch is on. */
  features?: Partial<Features>;
}) {
  const t = useTranslations("Doctors");
  const locale = useLocale();

  return (
    <article className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center`}>
      <DoctorAvatar
        name={doctor.name}
        photoUrl={doctor.photoUrl}
        alt={t("photoAlt", { name: doctor.name })}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="text-lg font-bold">
          <Link href={`/doctors/${doctor.slug}`} className="hover:underline">
            {doctor.name}
          </Link>
        </h3>
        <p className="text-sm font-medium text-accent">{doctor.specialty.name}</p>
        {features.reviews && doctor.rating ? <RatingBadge rating={doctor.rating} /> : null}
        <p className="text-sm text-muted">
          {doctor.clinic.name} — {cityLabel(doctor.clinic.city, locale)}
        </p>
        <p className="flex flex-wrap gap-x-4 text-sm text-muted">
          {doctor.yearsExperience ? (
            <span>{t("yearsExperience", {
                count: doctor.yearsExperience,
                n: formatPlain(doctor.yearsExperience, locale),
              })}</span>
          ) : null}
          {doctor.consultationFeeEgp != null ? (
            <span>{t("fee", { fee: formatEgp(doctor.consultationFeeEgp, locale) })}</span>
          ) : null}
        </p>
        {(features.videoConsultation && doctor.offersVideo) ||
        (features.insurance && (doctor.insuranceProviders?.length ?? 0) > 0) ? (
          <p className="flex flex-wrap items-center gap-2 pt-1">
            {features.videoConsultation && doctor.offersVideo ? <VideoBadge /> : null}
            {features.insurance && doctor.insuranceProviders?.length ? (
              <span className="text-xs text-muted">
                {t("insuranceAccepted", { providers: doctor.insuranceProviders.map((p) => p.name).join("، ") })}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2 sm:flex-col">
        <Link href={`/doctors/${doctor.slug}/book`} className={btnPrimary}>
          {t("bookNow")}
        </Link>
        <Link href={`/doctors/${doctor.slug}`} className={btnSecondary}>
          {t("viewProfile")}
        </Link>
      </div>
    </article>
  );
}
