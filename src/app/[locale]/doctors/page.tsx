import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DoctorCard } from "@/components/doctor-card";
import { btnPrimary, btnSecondary, card, container, inputClass, labelClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { getCities, getSpecialties, searchDoctors } from "@/lib/api/server";
import { formatNumber } from "@/lib/datetime";
import { orFallback } from "@/lib/safe";
import { pageMetadata } from "@/lib/seo";

const PAGE_SIZE = 10;

type Filters = { q?: string; city?: string; specialtyId?: string; page: number };

function readFilters(raw: { [key: string]: string | string[] | undefined }): Filters {
  const one = (key: string) => {
    const value = raw[key];
    const text = Array.isArray(value) ? value[0] : value;
    return text?.trim() || undefined;
  };
  const page = Number(one("page"));
  return {
    q: one("q"),
    city: one("city"),
    specialtyId: one("specialtyId"),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function hrefFor(filters: Filters, page: number) {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.city) search.set("city", filters.city);
  if (filters.specialtyId) search.set("specialtyId", filters.specialtyId);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/doctors?${query}` : "/doctors";
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/doctors">): Promise<Metadata> {
  const { locale } = await params;
  const filters = readFilters(await searchParams);
  const t = await getTranslations({ locale, namespace: "Doctors" });

  let title = t("metaTitle");
  if (filters.specialtyId) {
    const specialties = await orFallback(getSpecialties(locale), []);
    const match = specialties.find((s) => s.id === filters.specialtyId);
    if (match) title = t("metaTitleSpecialty", { specialty: match.name });
  }
  // Free-text searches and deep pages are not landing pages; keep them out of the index.
  return pageMetadata({
    locale,
    path: "/doctors",
    title,
    description: t("metaDescription"),
    noIndex: Boolean(filters.q || filters.page > 1),
  });
}

export default async function DoctorsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/doctors">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Doctors" });
  const filters = readFilters(await searchParams);

  const [specialties, cities, results] = await Promise.all([
    orFallback(getSpecialties(locale), []),
    orFallback(getCities(locale), []),
    searchDoctors(locale, {
      q: filters.q,
      city: filters.city,
      specialtyId: filters.specialtyId,
      page: filters.page,
      pageSize: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(results.totalCount / results.pageSize));
  const hasFilters = Boolean(filters.q || filters.city || filters.specialtyId);

  return (
    <main className={`${container} py-10`}>
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside>
          <form method="get" className={`${card} space-y-4 lg:sticky lg:top-24`}>
            <h2 className="font-bold">{t("filtersTitle")}</h2>
            <div>
              <label htmlFor="f-q" className={labelClass}>
                {t("searchLabel")}
              </label>
              <input
                id="f-q"
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder={t("searchPlaceholder")}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="f-specialty" className={labelClass}>
                {t("specialtyLabel")}
              </label>
              <select
                id="f-specialty"
                name="specialtyId"
                defaultValue={filters.specialtyId ?? ""}
                className={inputClass}
              >
                <option value="">{t("allSpecialties")}</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-city" className={labelClass}>
                {t("cityLabel")}
              </label>
              <select
                id="f-city"
                name="city"
                defaultValue={filters.city ?? ""}
                className={inputClass}
              >
                <option value="">{t("allCities")}</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={btnPrimary}>
                {t("apply")}
              </button>
              {hasFilters ? (
                <Link href="/doctors" className={btnSecondary}>
                  {t("reset")}
                </Link>
              ) : null}
            </div>
          </form>
        </aside>

        <section aria-live="polite" className="space-y-4">
          <p className="text-sm font-medium text-muted">
            {t("resultsCount", {
              count: results.totalCount,
              n: formatNumber(results.totalCount, locale),
            })}
          </p>

          {results.items.length === 0 ? (
            <div className={`${card} space-y-1 text-center`}>
              <p className="text-lg font-bold">{t("noResults")}</p>
              <p className="text-muted">{t("noResultsHint")}</p>
            </div>
          ) : (
            results.items.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} />)
          )}

          {totalPages > 1 ? (
            <nav
              aria-label={t("pagination")}
              className="flex items-center justify-between gap-3 pt-2"
            >
              {results.page > 1 ? (
                <Link href={hrefFor(filters, results.page - 1)} className={btnSecondary}>
                  {t("previous")}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted">
                {t("pageOf", {
                  page: formatNumber(results.page, locale),
                  total: formatNumber(totalPages, locale),
                })}
              </span>
              {results.page < totalPages ? (
                <Link href={hrefFor(filters, results.page + 1)} className={btnSecondary}>
                  {t("next")}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
