import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { searchDoctors } from "@/lib/api/server";
import { languageAlternates, localizedUrl } from "@/lib/seo";

// The doctor list comes from the API; regenerate hourly.
export const revalidate = 3600;

const STATIC_PATHS = ["/", "/doctors", "/about", "/contact", "/terms", "/privacy"];
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

async function doctorSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await searchDoctors(routing.defaultLocale, { page, pageSize: PAGE_SIZE });
      slugs.push(...res.items.map((d) => d.slug));
      if (page * res.pageSize >= res.totalCount) break;
    }
  } catch {
    // Without the API the sitemap still lists the static pages.
  }
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = [
    ...STATIC_PATHS,
    ...(await doctorSlugs()).map((slug) => `/doctors/${slug}`),
  ];

  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: localizedUrl(locale, path),
      changeFrequency: path === "/" || path === "/doctors" ? ("daily" as const) : ("weekly" as const),
      priority: path === "/" ? 1 : path.startsWith("/doctors/") ? 0.8 : 0.6,
      alternates: { languages: languageAlternates(path) },
    })),
  );
}
