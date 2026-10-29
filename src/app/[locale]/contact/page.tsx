import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { card, container } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";

const CONTACT_EMAIL = "hello@moonlight.example";
const CONTACT_PHONE = "+20 2 5550 0100";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });
  return pageMetadata({
    locale,
    path: "/contact",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Contact" });

  return (
    <main className={`${container} max-w-3xl py-12`}>
      <h1 className="mb-4 text-4xl font-extrabold">{t("title")}</h1>
      <p className="mb-8 text-lg text-muted">{t("intro")}</p>

      <dl className={`${card} grid gap-4 sm:grid-cols-[auto_1fr] sm:gap-x-8`}>
        <dt className="font-medium text-muted">{t("email")}</dt>
        <dd>
          <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="font-semibold text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
        </dd>
        <dt className="font-medium text-muted">{t("phone")}</dt>
        <dd>
          <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`} dir="ltr" className="font-semibold hover:underline">
            {CONTACT_PHONE}
          </a>
        </dd>
        <dt className="font-medium text-muted">{t("hours")}</dt>
        <dd>{t("hoursValue")}</dd>
        <dt className="font-medium text-muted">{t("address")}</dt>
        <dd>{t("addressValue")}</dd>
      </dl>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className={`${card} space-y-2`}>
          <h2 className="font-bold">{t("clinicsTitle")}</h2>
          <p className="text-muted">{t("clinicsText")}</p>
        </section>
        <section className={`${card} space-y-2`}>
          <h2 className="font-bold">{t("patientsTitle")}</h2>
          <p className="text-muted">{t("patientsText")}</p>
        </section>
      </div>
    </main>
  );
}
