import { describe, expect, it } from "vitest";

import type { DoctorProfile } from "./api/types";
import { buildDoctorJsonLd, buildPageMetadata, languageAlternates, localizedUrl, serializeJsonLd } from "./seo";

const BASE = "https://moonlight.example";

const doctor: DoctorProfile = {
  id: "d1",
  slug: "sara-hassan",
  name: "Dr. Sara Hassan",
  photoUrl: "https://cdn.example/sara.jpg",
  specialty: { id: "s1", name: "General Dentistry" },
  clinic: {
    id: "c1",
    name: "Moonlight Dental Center",
    city: "Cairo",
    address: "12 Road 9, Maadi",
    phone: "+20225550100",
    latitude: 29.96,
    longitude: 31.25,
    timezone: "Africa/Cairo",
  },
  bio: "General dentist.",
  yearsExperience: 12,
  consultationFeeEgp: 300,
  services: [],
};

describe("urls and hreflang", () => {
  it("builds locale-prefixed absolute URLs", () => {
    expect(localizedUrl("ar", "/", BASE)).toBe(`${BASE}/ar`);
    expect(localizedUrl("en", "/doctors/x", BASE)).toBe(`${BASE}/en/doctors/x`);
  });

  it("lists every locale plus x-default pointing at Arabic", () => {
    expect(languageAlternates("/doctors/x", BASE)).toEqual({
      ar: `${BASE}/ar/doctors/x`,
      en: `${BASE}/en/doctors/x`,
      "x-default": `${BASE}/ar/doctors/x`,
    });
  });
});

describe("pageMetadata", () => {
  it("sets canonical, hreflang alternates and Open Graph for the locale", () => {
    const meta = buildPageMetadata({
      locale: "en",
      path: "/doctors/sara-hassan",
      title: "Dr. Sara Hassan",
      description: "Book",
    });
    expect(meta.alternates?.canonical).toMatch(/\/en\/doctors\/sara-hassan$/);
    expect(Object.keys(meta.alternates?.languages ?? {})).toEqual(["ar", "en", "x-default"]);
    expect(meta.openGraph).toMatchObject({ locale: "en_US", type: "website" });
    expect(meta.robots).toBeUndefined();
  });

  it("marks private pages noindex", () => {
    const meta = buildPageMetadata({ locale: "ar", path: "/account/appointments", title: "t", description: "d", noIndex: true });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

describe("buildDoctorJsonLd", () => {
  it("describes the dentist as a schema.org Physician", () => {
    const ld = buildDoctorJsonLd(doctor, "en", BASE);

    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Physician");
    expect(ld.name).toBe("Dr. Sara Hassan");
    expect(ld.url).toBe(`${BASE}/en/doctors/sara-hassan`);
    expect(ld.medicalSpecialty).toBe("Dentistry");
    expect(ld.image).toBe("https://cdn.example/sara.jpg");
    expect(ld.telephone).toBe("+20225550100");
    expect(ld.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "12 Road 9, Maadi",
      addressLocality: "Cairo",
      addressCountry: "EG",
    });
    expect(ld.geo).toEqual({ "@type": "GeoCoordinates", latitude: 29.96, longitude: 31.25 });
    expect(ld.priceRange).toBe("300 EGP");
    expect(ld.location).toMatchObject({ "@type": "Dentist", name: "Moonlight Dental Center" });
  });

  it("omits optional fields that the API did not return", () => {
    const ld = buildDoctorJsonLd(
      { ...doctor, bio: null, photoUrl: null, consultationFeeEgp: null, clinic: { ...doctor.clinic, latitude: null, longitude: null } },
      "ar",
      BASE,
    );
    expect(ld).not.toHaveProperty("description");
    expect(ld).not.toHaveProperty("image");
    expect(ld).not.toHaveProperty("geo");
    expect(ld).not.toHaveProperty("priceRange");
    expect(ld.url).toBe(`${BASE}/ar/doctors/sara-hassan`);
  });

  it("adds aggregateRating only when the doctor has ratings", () => {
    expect(buildDoctorJsonLd(doctor, "en", BASE)).not.toHaveProperty("aggregateRating");
    expect(buildDoctorJsonLd({ ...doctor, rating: null }, "en", BASE)).not.toHaveProperty("aggregateRating");
    expect(buildDoctorJsonLd({ ...doctor, rating: { average: 4.8, count: 0 } }, "en", BASE)).not.toHaveProperty(
      "aggregateRating",
    );
    expect(buildDoctorJsonLd({ ...doctor, rating: { average: 4.8, count: 23 } }, "en", BASE).aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.8,
      reviewCount: 23,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it("serializes to JSON that cannot close the script tag", () => {
    const text = serializeJsonLd(
      buildDoctorJsonLd({ ...doctor, bio: "</script><script>alert(1)</script>" }, "en", BASE),
    );
    expect(text).not.toContain("</script>");
    expect(text).not.toContain("<");
    expect(JSON.parse(text).description).toBe("</script><script>alert(1)</script>");
  });
});
