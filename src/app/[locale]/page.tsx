import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MoonMark } from "@/components/logo";
import { btnPrimary, btnSecondary, card, container, inputClass, labelClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { getCities, getSpecialties } from "@/lib/api/server";
import { formatPlain } from "@/lib/datetime";
import { orFallback } from "@/lib/safe";
import { pageMetadata } from "@/lib/seo";

// Specialties/cities come from the API; refresh the static page every 5 minutes.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  return pageMetadata({
    locale,
    path: "/",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Home" });
  const footer = await getTranslations({ locale, namespace: "Footer" });

  const [specialties, cities] = await Promise.all([
    orFallback(getSpecialties(locale), []),
    orFallback(getCities(locale), []),
  ]);

  const steps = [1, 2, 3] as const;
  const benefits = [1, 2, 3] as const;

  return (
    <main>
      <section className="relative overflow-hidden bg-night text-night-foreground">
        <div
          aria-hidden="true"
          className="absolute -end-24 -top-24 size-96 rounded-full bg-primary/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 start-0 size-96 rounded-full bg-accent/20 blur-3xl"
        />
        <div className={`${container} relative grid gap-10 py-16 md:grid-cols-[1.2fr_0.8fr] md:py-24`}>
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium">
              <MoonMark className="size-5" />
              {t("heroEyebrow")}
            </p>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-xl text-lg opacity-80">{t("heroSubtitle")}</p>

            <form
              action={`/${locale}/doctors`}
              method="get"
              className="grid gap-3 rounded-2xl bg-surface p-4 text-foreground shadow-xl sm:grid-cols-[1fr_auto_auto] sm:items-end"
            >
              <div>
                <label htmlFor="home-q" className={labelClass}>
                  {t("searchLabel")}
                </label>
                <input
                  id="home-q"
                  name="q"
                  type="search"
                  placeholder={t("searchPlaceholder")}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="home-city" className={labelClass}>
                  {t("cityLabel")}
                </label>
                <select id="home-city" name="city" className={inputClass} defaultValue="">
                  <option value="">{t("allCities")}</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className={btnPrimary}>
                {t("searchButton")}
              </button>
            </form>
          </div>

          <ul className="hidden gap-3 self-center md:grid" aria-hidden="true">
            {benefits.map((n) => (
              <li key={n} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="font-bold">{t(`benefit${n}Title`)}</p>
                <p className="text-sm opacity-75">{t(`benefit${n}Text`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${container} py-14`}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{t("specialtiesTitle")}</h2>
            <p className="text-muted">{t("specialtiesSubtitle")}</p>
          </div>
          <Link href="/doctors" className={btnSecondary}>
            {t("allDoctors")}
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {specialties.map((specialty) => (
            <li key={specialty.id}>
              <Link
                href={`/doctors?specialtyId=${specialty.id}`}
                className={`${card} flex h-full items-center gap-3 font-semibold transition-colors hover:border-primary`}
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
                >
                  <MoonMark className="size-5" />
                </span>
                {specialty.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface-muted py-14">
        <div className={container}>
          <h2 className="mb-8 text-2xl font-bold">{t("stepsTitle")}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((n) => (
              <li key={n} className={`${card} space-y-2`}>
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {formatPlain(n, locale)}
                </span>
                <h3 className="text-lg font-bold">{t(`step${n}Title`)}</h3>
                <p className="text-muted">{t(`step${n}Text`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${container} py-14`}>
        <h2 className="mb-6 text-2xl font-bold">{t("benefitsTitle")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {benefits.map((n) => (
            <div key={n} className={`${card} space-y-1`}>
              <h3 className="font-bold text-accent">{t(`benefit${n}Title`)}</h3>
              <p className="text-muted">{t(`benefit${n}Text`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${container} pb-4`}>
        <div className="grid items-center gap-6 rounded-3xl bg-primary p-8 text-primary-foreground md:grid-cols-[1fr_auto] md:p-12">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{t("appTitle")}</h2>
            <p className="max-w-xl opacity-90">{t("appText")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex min-h-11 items-center rounded-xl bg-night px-5 text-sm font-semibold text-night-foreground">
              {footer("appStore")}
            </span>
            <span className="inline-flex min-h-11 items-center rounded-xl bg-night px-5 text-sm font-semibold text-night-foreground">
              {footer("googlePlay")}
            </span>
          </div>
        </div>
      </section>

      <section className={`${container} py-14 text-center`}>
        <h2 className="mb-4 text-2xl font-bold">{t("ctaTitle")}</h2>
        <Link href="/doctors" className={btnPrimary}>
          {t("ctaButton")}
        </Link>
      </section>
    </main>
  );
}
