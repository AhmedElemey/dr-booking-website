import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { directionFor, routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/api/config";
import { brandName, brandTagline, clinicConfig, logoPublicPath } from "@/lib/clinic-config";
import { brandCss } from "@/lib/colors";
import { getFeatures } from "@/lib/features";

import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const name = brandName(locale);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${name} | ${brandTagline(locale)}`, template: `%s | ${name}` },
    description: t("description"),
    applicationName: name,
    icons: { icon: logoPublicPath() },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const features = await getFeatures();
  // Proxy redirects /en/... already; this covers any request that slips past it.
  if (locale === "en" && !features.englishLanguage) redirect("/ar");

  return (
    <html lang={locale} dir={directionFor(locale)} className="h-full antialiased">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: brandCss(clinicConfig.colors.primary, clinicConfig.colors.accent),
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <SiteHeader features={features} />
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter features={features} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
