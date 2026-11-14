import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { getFeatures } from "./lib/features";
import { englishRedirect } from "./lib/locale-gate";
import { routing } from "./i18n/routing";

// Redirects / to the visitor's locale (/ar by default) and keeps the locale prefix on every page.
const intl = createMiddleware(routing);
// Used while the English language switch is off: Arabic only, no locale negotiation.
const arabicOnly = createMiddleware({ locales: ["ar"], defaultLocale: "ar", localeDetection: false });

export default async function proxy(request: NextRequest) {
  const features = await getFeatures();
  const target = englishRedirect(request.nextUrl.pathname, features.englishLanguage);
  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url, 308);
  }
  return features.englishLanguage ? intl(request) : arabicOnly(request);
}

export const config = {
  // Skip API routes, Next internals and files with an extension.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
