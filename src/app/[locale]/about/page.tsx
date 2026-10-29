import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ContentPage } from "@/components/content-page";
import { btnPrimary } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return pageMetadata({
    locale,
    path: "/about",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  const nav = await getTranslations({ locale, namespace: "Nav" });
  return (
    <ContentPage locale={locale} namespace="About">
      <Link href="/doctors" className={`${btnPrimary} mt-10`}>
        {nav("doctors")}
      </Link>
    </ContentPage>
  );
}
