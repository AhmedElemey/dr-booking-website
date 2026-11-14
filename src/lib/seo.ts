import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

import { siteUrl } from "./api/config";
import type { DoctorProfile } from "./api/types";

/** Absolute URL of a locale-prefixed path (`/doctors` with `ar` becomes `<site>/ar/doctors`). */
export function localizedUrl(locale: string, path: string, base = siteUrl()): string {
  const clean = path === "/" ? "" : path;
  return `${base}/${locale}${clean}`;
}

/** hreflang map for every locale, plus `x-default` pointing at the default locale. */
export function languageAlternates(path: string, base = siteUrl()) {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = localizedUrl(locale, path, base);
  }
  languages["x-default"] = localizedUrl(routing.defaultLocale, path, base);
  return languages;
}

type PageMetadataInput = {
  locale: string;
  path: string;
  title: string;
  description: string;
  noIndex?: boolean;
  image?: string | null;
};

/** Title, description, canonical + hreflang alternates and Open Graph for a page. */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  noIndex,
  image,
}: PageMetadataInput): Metadata {
  const url = localizedUrl(locale, path);
  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      title,
      description,
      url,
      siteName: "Moonlight",
      locale: locale === "ar" ? "ar_EG" : "en_US",
      type: "website",
      ...(image ? { images: [image] } : {}),
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** schema.org `Physician` JSON-LD for a doctor profile page. */
export function buildDoctorJsonLd(
  doctor: DoctorProfile,
  locale: string,
  base = siteUrl(),
): Record<string, unknown> {
  const { clinic } = doctor;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Physician",
    "@id": `${localizedUrl(locale, `/doctors/${doctor.slug}`, base)}#physician`,
    name: doctor.name,
    url: localizedUrl(locale, `/doctors/${doctor.slug}`, base),
    medicalSpecialty: "Dentistry",
    knowsAbout: doctor.specialty.name,
    inLanguage: locale,
    address: {
      "@type": "PostalAddress",
      streetAddress: clinic.address,
      addressLocality: clinic.city,
      addressCountry: "EG",
    },
    telephone: clinic.phone,
    location: {
      "@type": "Dentist",
      name: clinic.name,
      telephone: clinic.phone,
      address: {
        "@type": "PostalAddress",
        streetAddress: clinic.address,
        addressLocality: clinic.city,
        addressCountry: "EG",
      },
    },
  };
  if (doctor.bio) ld.description = doctor.bio;
  if (doctor.photoUrl) ld.image = doctor.photoUrl;
  if (clinic.latitude != null && clinic.longitude != null) {
    ld.geo = {
      "@type": "GeoCoordinates",
      latitude: clinic.latitude,
      longitude: clinic.longitude,
    };
  }
  if (doctor.consultationFeeEgp != null) {
    ld.priceRange = `${doctor.consultationFeeEgp} EGP`;
  }
  return ld;
}

/** Serializes JSON-LD for a `<script>` tag, escaping `<` so content cannot close it. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
