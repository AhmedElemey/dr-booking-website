import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/api/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private, per-user pages and the BFF routes carry no SEO value.
      disallow: ["/api/", "/ar/account", "/en/account", "/ar/doctors/*/book", "/en/doctors/*/book", "/ar/appointments/", "/en/appointments/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
