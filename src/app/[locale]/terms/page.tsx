import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms" });
  return pageMetadata({
    locale,
    path: "/terms",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  return <ContentPage locale={locale} namespace="Terms" />;
}
