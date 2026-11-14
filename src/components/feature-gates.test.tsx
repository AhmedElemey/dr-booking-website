import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Outside the Next router usePathname is null, which the language switcher cannot link from.
vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/navigation")>()),
  usePathname: () => "/",
}));

import { defaultFeatures } from "@/lib/features";
import { clinicConfig } from "@/lib/clinic-config";
import { problem, renderWithIntl, stubApi } from "@/test/render";

import { AppointmentsView } from "./appointments-view";
import { BookingUnavailable } from "./booking-unavailable";
import { CityField } from "./city-field";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const features = defaultFeatures();

describe("website=false: booking unavailable page", () => {
  it("asks the patient to call the clinic phone", () => {
    renderWithIntl(<BookingUnavailable />);
    expect(screen.getByRole("heading", { name: "Online booking is not available" })).toBeTruthy();
    expect(screen.getAllByText(new RegExp(`\\${clinicConfig.supportPhone}`)).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Call/ }).getAttribute("href")).toBe(
      `tel:${clinicConfig.supportPhone}`,
    );
    expect(screen.getByRole("link", { name: "Back to home" })).toBeTruthy();
  });

  it("is localized", () => {
    renderWithIntl(<BookingUnavailable />, "ar");
    expect(screen.getByRole("heading", { name: "الحجز عبر الإنترنت غير متاح" })).toBeTruthy();
  });

  it("header and footer drop the booking links but keep about and contact", () => {
    renderWithIntl(<SiteHeader features={{ ...features, website: false }} />);
    expect(screen.queryByRole("link", { name: "Find a dentist" })).toBeNull();
    expect(screen.queryByRole("link", { name: "My appointments" })).toBeNull();
    expect(screen.getByRole("link", { name: "Contact" })).toBeTruthy();
    renderWithIntl(<SiteFooter features={{ ...features, website: false }} />);
    expect(screen.queryAllByRole("link", { name: "Find a dentist" })).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Terms of use" })).toBeTruthy();
  });

  it("header shows the booking links when the website is on", () => {
    renderWithIntl(<SiteHeader features={features} />);
    expect(screen.getByRole("link", { name: "Find a dentist" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "My appointments" })).toBeTruthy();
  });
});

describe("branding", () => {
  it("shows the clinic name from the config in header and footer, never a hard-coded one", () => {
    const original = clinicConfig.name.en;
    expect(original).toBe("Moonlight");
    renderWithIntl(<SiteHeader features={features} />);
    expect(screen.getByRole("link", { name: `${original} home` })).toBeTruthy();
    renderWithIntl(<SiteFooter features={features} />);
    expect(screen.getByText(new RegExp(`© \\d{4} ${original}`))).toBeTruthy();
    expect(screen.getByText(clinicConfig.tagline.en)).toBeTruthy();
  });
});

describe("englishLanguage=false", () => {
  it("hides the language switcher", () => {
    renderWithIntl(<SiteHeader features={{ ...features, englishLanguage: false }} />, "ar");
    expect(screen.queryByRole("link", { name: "English" })).toBeNull();
    expect(document.querySelector("a[lang]")).toBeNull();
  });

  it("shows the language switcher otherwise", () => {
    renderWithIntl(<SiteHeader features={features} />, "ar");
    expect(document.querySelector("a[lang='en']")).not.toBeNull();
  });
});

describe("multiBranch=false", () => {
  const props = {
    id: "c",
    cities: ["Cairo", "Giza"],
    locale: "en",
    label: "City",
    allLabel: "All cities",
  };

  it("hides the city filter", () => {
    renderWithIntl(<CityField enabled={false} {...props} />);
    expect(screen.queryByLabelText("City")).toBeNull();
  });

  it("shows the city filter when enabled", () => {
    renderWithIntl(<CityField enabled {...props} />);
    expect(screen.getByLabelText("City")).toBeTruthy();
    expect(screen.getByRole("option", { name: "All cities" })).toBeTruthy();
  });
});

describe("patientSelfService", () => {
  const appointment = {
    id: "a1",
    status: "Confirmed",
    slotId: "s1",
    startsAt: "2099-01-02T09:00:00Z",
    endsAt: "2099-01-02T09:30:00Z",
    startsAtLocal: "2099-01-02T11:00:00+02:00",
    timezone: "Africa/Cairo",
    doctor: { id: "d1", slug: "sara-hassan", name: "Dr. Sara Hassan" },
    clinic: { id: "c1", name: "Clinic", address: "12 Road 9", phone: "+20225550100" },
  };
  const page = (items: unknown[]) => ({ items, page: 1, pageSize: 50, totalCount: items.length });
  const routes = () => ({
    "GET /api/me": () =>
      Response.json({ id: "u1", phone: "+201012345678", fullName: "Ahmed", role: "Patient", preferredLanguage: "en" }),
    "GET /api/appointments": (url: string) =>
      Response.json(page(url.includes("scope=upcoming") ? [appointment] : [])),
  });

  it("shows cancel and reschedule when enabled", async () => {
    stubApi(routes());
    renderWithIntl(<AppointmentsView />);
    expect(await screen.findByRole("button", { name: "Reschedule" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel appointment" })).toBeTruthy();
  });

  it("hides them and tells the patient to call the clinic when disabled", async () => {
    stubApi(routes());
    renderWithIntl(<AppointmentsView selfService={false} />);
    expect(await screen.findByRole("link", { name: "Call clinic" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reschedule" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel appointment" })).toBeNull();
    expect(screen.getByText(/please call the clinic on \+201000000000/i)).toBeTruthy();
  });

  it("shows a localized message for a 403 FEATURE_DISABLED problem", async () => {
    stubApi({
      ...routes(),
      "POST /api/appointments/a1/cancel": () => problem("FEATURE_DISABLED", 403),
    });
    renderWithIntl(<AppointmentsView />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel appointment" }));
    fireEvent.click(await screen.findByRole("button", { name: /Yes, cancel/i }));
    expect(
      await screen.findByText("This service is not available online. Please call the clinic on +201000000000."),
    ).toBeTruthy();
  });
});
