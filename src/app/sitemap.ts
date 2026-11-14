import type { MetadataRoute } from "next";

import { searchDoctors } from "@/lib/api/server";
import { activeLocales, getFeatures } from "@/lib/features";
import { languageAlternates, localizedUrl } from "@/lib/seo";

// The doctor list comes from the API; regenerate hourly.
export const revalidate = 3600;

const STATIC_PATHS = ["/", "/doctors", "/about", "/contact", "/terms", "/privacy"];
// Pages that need online booking; left out of the sitemap while the website feature is off.
const BOOKING_PATHS = new Set(["/doctors"]);
const DEFAULT_LOCALE = "ar";
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function doctorSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await searchDoctors(DEFAULT_LOCALE, { page, pageSize: PAGE_SIZE });
      slugs.push(...res.items.map((d) => d.slug));
      if (page * res.pageSize >= res.totalCount) break;
    }
  } catch {
    // Without the API the sitemap still lists the static pages.
  }
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const features = await getFeatures();
  const locales = activeLocales(features);
  const paths = features.website
    ? [...STATIC_PATHS, ...(await doctorSlugs()).map((slug) => `/doctors/${slug}`)]
    : STATIC_PATHS.filter((path) => !BOOKING_PATHS.has(path));

  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: localizedUrl(locale, path),
      changeFrequency: path === "/" || path === "/doctors" ? ("daily" as const) : ("weekly" as const),
      priority: path === "/" ? 1 : path.startsWith("/doctors/") ? 0.8 : 0.6,
      alternates: { languages: languageAlternates(path, undefined, locales) },
    })),
  );
}
