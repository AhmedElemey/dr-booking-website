import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return pageMetadata({
    locale,
    path: "/privacy",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  return <ContentPage locale={locale} namespace="Privacy" />;
}
