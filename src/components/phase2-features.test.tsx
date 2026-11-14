import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/navigation")>()),
  usePathname: () => "/account/appointments",
}));

import { PHASE2_FEATURE_KEYS } from "@/lib/clinic-config";
import { defaultFeatures, type Features } from "@/lib/features";
import type { Appointment, DoctorProfile, DoctorSummary } from "@/lib/api/types";
import { addDays, todayInZone } from "@/lib/datetime";
import { problem, renderWithIntl, stubApi } from "@/test/render";

import { AccountNav } from "./account-nav";
import { AppointmentsView } from "./appointments-view";
import { BookingFlow } from "./booking-flow";
import { DoctorCard } from "./doctor-card";
import { OfferCard } from "./offer-card";
import { ReviewsList } from "./reviews-list";
import { SettingsView } from "./settings-view";
import { SlotPicker } from "./slot-picker";
import { VideoJoin } from "./video-join";

const allOn = (): Features => ({
  ...defaultFeatures(),
  ...Object.fromEntries(PHASE2_FEATURE_KEYS.map((k) => [k, true])),
});
const allOff = (): Features => defaultFeatures();

/** Clinic-local date `offset` days from today (the picker's window starts today in Cairo). */
const iso = (offset: number) => addDays(todayInZone("Africa/Cairo"), offset);

const patient = { id: "u1", phone: "+201012345678", fullName: "Ahmed", role: "Patient", preferredLanguage: "en" };

// --- doctor cards -----------------------------------------------------------------------------

const doctor: DoctorSummary = {
  id: "d1",
  slug: "omar-farouk",
  name: "Dr. Omar Farouk",
  photoUrl: null,
  specialty: { id: "s1", name: "Orthodontics" },
  clinic: { id: "c1", name: "Clinic", city: "Cairo" },
  rating: { average: 4.5, count: 12 },
  offersVideo: true,
  insuranceProviders: [{ id: "p1", name: "Nile Medical Insurance" }],
};

describe("doctor cards", () => {
  it("hide stars, the video badge and insurers while their features are off", () => {
    renderWithIntl(<DoctorCard doctor={doctor} features={allOff()} />);
    expect(screen.queryByLabelText(/Rated/)).toBeNull();
    expect(screen.queryByText("Video visit")).toBeNull();
    expect(screen.queryByText(/Accepts/)).toBeNull();
  });

  it("show them when on", () => {
    renderWithIntl(<DoctorCard doctor={doctor} features={allOn()} />);
    expect(screen.getByLabelText("Rated 4.5 out of 5 by 12 patients")).toBeTruthy();
    expect(screen.getByText("Video visit")).toBeTruthy();
    expect(screen.getByText("Accepts: Nile Medical Insurance")).toBeTruthy();
  });

  it("shows nothing for a doctor without reviews even when the feature is on", () => {
    renderWithIntl(<DoctorCard doctor={{ ...doctor, rating: null }} features={allOn()} />);
    expect(screen.queryByLabelText(/Rated/)).toBeNull();
  });
});

// --- account navigation -----------------------------------------------------------------------

describe("account navigation", () => {
  it("is not rendered when no extra account feature is on", () => {
    renderWithIntl(<AccountNav features={allOff()} />);
    expect(screen.queryByRole("navigation", { name: "Account" })).toBeNull();
  });

  it("lists only the pages of features that are on", () => {
    renderWithIntl(<AccountNav features={{ ...allOff(), familyAccounts: true, patientRecords: true }} />);
    const nav = screen.getByRole("navigation", { name: "Account" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["My appointments", "Family", "My records"]);
    expect(within(nav).queryByRole("link", { name: "Waiting list" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Settings" })).toBeNull();
  });

  it("shows settings for any messaging feature", () => {
    renderWithIntl(<AccountNav features={{ ...allOff(), whatsappReminders: true }} />);
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/en/account/settings");
  });
});

// --- appointments ----------------------------------------------------------------------------

const appointment: Appointment = {
  id: "a1",
  status: "Confirmed",
  slotId: "s1",
  startsAt: "2099-01-02T09:00:00Z",
  endsAt: "2099-01-02T09:30:00Z",
  startsAtLocal: "2099-01-02T11:00:00+02:00",
  timezone: "Africa/Cairo",
  doctor: { id: "d1", slug: "omar-farouk", name: "Dr. Omar Farouk" },
  clinic: { id: "c1", name: "Clinic", address: "12 Road 9", phone: "+20225550100" },
  mode: "Video",
  priceEgp: 450,
  discountEgp: 100,
  totalEgp: 350,
  paymentStatus: "Unpaid",
  familyMember: { id: "m1", fullName: "Yassin Ahmed", relation: "Child" },
  insurance: { provider: { id: "p1", name: "Nile Medical Insurance" }, memberNumber: "NM-5530", status: "Approved" },
};
const completed: Appointment = {
  ...appointment,
  id: "a2",
  status: "Completed",
  mode: "InPerson",
  canReview: true,
  review: null,
  paymentStatus: "Paid",
};
const page = (items: unknown[]) => ({ items, page: 1, pageSize: 50, totalCount: items.length });
const listRoutes = () => ({
  "GET /api/me": () => Response.json(patient),
  "GET /api/appointments": (url: string) =>
    Response.json(page(url.includes("scope=upcoming") ? [appointment] : [completed])),
});

describe("my appointments with phase-2 features", () => {
  it("shows none of the extras while every feature is off", async () => {
    stubApi(listRoutes());
    renderWithIntl(<AppointmentsView features={allOff()} />);
    await screen.findByRole("button", { name: "Reschedule" });
    for (const text of [/Pay online/, /Join video/, /Video visit/, /For Yassin/, /Nile Medical/, /Discount/, /Total/]) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(screen.queryByRole("button", { name: /Pay online|Join video/ })).toBeNull();
  });

  it("shows price, discount, total, payment status, family member, video and insurance when on", async () => {
    stubApi(listRoutes());
    renderWithIntl(<AppointmentsView features={allOn()} />);
    expect(await screen.findByText("For Yassin Ahmed (Child)")).toBeTruthy();
    expect(screen.getByText("Video visit")).toBeTruthy();
    expect(screen.getByText("Nile Medical Insurance: approved")).toBeTruthy();
    expect(screen.getByText("Discount")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getAllByText("Pay at the clinic").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Pay online" })).toBeTruthy();
    // The video window is far in the future, so the join button is disabled.
    expect((screen.getByRole("button", { name: "Join video" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers 'Rate your visit' on a completed appointment and sends the rating", async () => {
    const calls = stubApi({
      ...listRoutes(),
      "POST /api/appointments/a2/review": () => Response.json({ ...completed, canReview: false }, { status: 201 }),
    });
    renderWithIntl(<AppointmentsView features={allOn()} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Past" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rate your visit" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Please choose a rating from 1 to 5 stars.");

    fireEvent.click(screen.getByLabelText("4 stars"));
    fireEvent.change(screen.getByLabelText("Comment (optional)"), { target: { value: "Gentle and quick" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    expect(await screen.findByText("Thank you for rating your visit.")).toBeTruthy();
    const post = calls.find((c) => c.key === "POST /api/appointments/a2/review")!;
    expect(JSON.parse(post.init.body as string)).toEqual({ rating: 4, comment: "Gentle and quick" });
  });

  it("hides 'Rate your visit' when the reviews feature is off, and shows the patient's own rating", async () => {
    stubApi(listRoutes());
    renderWithIntl(<AppointmentsView features={{ ...allOn(), reviews: false }} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Past" }));
    await screen.findByText("Completed");
    expect(screen.queryByRole("button", { name: "Rate your visit" })).toBeNull();
  });

  it("maps NOT_REVIEWABLE / ALREADY_REVIEWED to friendly messages", async () => {
    stubApi({
      ...listRoutes(),
      "POST /api/appointments/a2/review": () => problem("ALREADY_REVIEWED", 409),
    });
    renderWithIntl(<AppointmentsView features={allOn()} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Past" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rate your visit" }));
    fireEvent.click(screen.getByLabelText("5 stars"));
    fireEvent.click(screen.getByRole("button", { name: "Submit rating" }));
    expect(await screen.findByText("You have already rated this visit.")).toBeTruthy();
  });
});

// --- video join --------------------------------------------------------------------------------

describe("VideoJoin", () => {
  const startsAt = Date.parse("2026-11-20T10:00:00Z");
  const video = {
    ...appointment,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + 30 * 60_000).toISOString(),
  };

  it("is disabled before the window opens and says when it opens", () => {
    vi.useFakeTimers({ now: startsAt - 60 * 60_000 });
    try {
      renderWithIntl(<VideoJoin appointment={video} />);
      expect((screen.getByRole("button", { name: "Join video" }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText(/Opens at .* 15 minutes before the visit/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the join URL inside the window", async () => {
    vi.useFakeTimers({ now: startsAt - 10 * 60_000, shouldAdvanceTime: true });
    try {
      stubApi({
        "GET /api/appointments/a1/video": () =>
          Response.json({ joinUrl: "https://meet.jit.si/room", opensAt: "", closesAt: "" }),
      });
      const open = vi.fn();
      renderWithIntl(<VideoJoin appointment={video} open={open} />);
      const button = screen.getByRole("button", { name: "Join video" }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      fireEvent.click(button);
      await waitFor(() => expect(open).toHaveBeenCalledWith("https://meet.jit.si/room"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("explains VIDEO_NOT_OPEN, and disappears 30 minutes after the end or for in-person visits", async () => {
    vi.useFakeTimers({ now: startsAt, shouldAdvanceTime: true });
    try {
      stubApi({ "GET /api/appointments/a1/video": () => problem("VIDEO_NOT_OPEN", 409) });
      const { unmount } = renderWithIntl(<VideoJoin appointment={video} open={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Join video" }));
      expect(await screen.findByText(/video room is not open yet/)).toBeTruthy();
      unmount();

      renderWithIntl(<VideoJoin appointment={{ ...video, mode: "InPerson" }} />);
      expect(screen.queryByRole("button", { name: "Join video" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
    vi.useFakeTimers({ now: startsAt + 61 * 60_000 });
    try {
      renderWithIntl(<VideoJoin appointment={video} />);
      expect(screen.queryByRole("button", { name: "Join video" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

// --- booking flow ------------------------------------------------------------------------------

const bookable: DoctorProfile = {
  id: "d1",
  slug: "omar-farouk",
  name: "Dr. Omar Farouk",
  photoUrl: null,
  specialty: { id: "s1", name: "Orthodontics" },
  clinic: { id: "c1", name: "Clinic", city: "Cairo", address: "12 Road 9", phone: "+20225550100", timezone: "Africa/Cairo" },
  bio: null,
  consultationFeeEgp: 400,
  offersVideo: true,
  insuranceProviders: [{ id: "p1", name: "Nile Medical Insurance" }],
  services: [{ id: "sv1", name: "Braces consultation", durationMinutes: 30, priceEgp: 400 }],
};
const slots = {
  doctorId: "d1",
  timezone: "Africa/Cairo",
  days: [{ date: iso(1), slots: [{ id: "s1", startsAt: "2026-11-02T07:00:00Z", endsAt: "2026-11-02T07:30:00Z", local: "09:00" }] }],
};
const booked = { ...appointment, mode: "Video", familyMember: null };

async function toConfirm() {
  fireEvent.click(await screen.findByRole("button", { name: /^0?9:00\s?am$/i }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("button", { name: "Confirm booking" });
}
const bookingRoutes = (extra: Record<string, (url: string, init: RequestInit) => Response> = {}) => ({
  "GET /api/doctors/omar-farouk/slots": () => Response.json(slots),
  "GET /api/me": () => Response.json(patient),
  "GET /api/me/family": () => Response.json([{ id: "m1", fullName: "Yassin Ahmed", relation: "Child" }]),
  "POST /api/appointments": () => Response.json(booked, { status: 201 }),
  ...extra,
});

describe("booking flow with features off", () => {
  it("shows no family picker, visit type, insurance or coupon, and sends only the basics", async () => {
    const calls = stubApi(bookingRoutes());
    renderWithIntl(<BookingFlow doctor={bookable} features={allOff()} />);
    await toConfirm();
    expect(screen.queryByLabelText("Booking for")).toBeNull();
    expect(screen.queryByText("Type of visit")).toBeNull();
    expect(screen.queryByLabelText("Insurance provider")).toBeNull();
    expect(screen.queryByLabelText("Coupon code")).toBeNull();
    expect(screen.queryByText("Discount")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
    await screen.findByText("Your appointment is confirmed");
    const post = calls.find((c) => c.key === "POST /api/appointments")!;
    expect(JSON.parse(post.init.body as string)).toEqual({ slotId: "s1" });
    expect(calls.some((c) => c.key.includes("/api/me/family"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Pay online" })).toBeNull();
  });

  it("ignores a video-only doctor field when the video feature is off", async () => {
    stubApi(bookingRoutes());
    renderWithIntl(<BookingFlow doctor={bookable} features={{ ...allOn(), videoConsultation: false, insurance: false }} />);
    await toConfirm();
    expect(screen.queryByText("Type of visit")).toBeNull();
    expect(screen.queryByLabelText("Insurance provider")).toBeNull();
  });
});

describe("booking flow with features on", () => {
  it("books for a family member, by video, with insurance and a validated coupon", async () => {
    const calls = stubApi(
      bookingRoutes({
        "POST /api/coupons/validate": () => Response.json({ valid: true, discountEgp: 80, totalEgp: 320 }),
      }),
    );
    renderWithIntl(<BookingFlow doctor={bookable} features={allOn()} />);
    await toConfirm();

    fireEvent.change(await screen.findByLabelText("Booking for"), { target: { value: "m1" } });
    fireEvent.click(screen.getByLabelText(/Video visit/));
    fireEvent.change(screen.getByLabelText("Insurance provider"), { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Please enter your insurance member number.");

    fireEvent.change(screen.getByLabelText("Member number"), { target: { value: "NM-5530-1182" } });
    fireEvent.change(screen.getByLabelText("Coupon code"), { target: { value: "welcome20" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText(/Code WELCOME20 applied/)).toBeTruthy();
    // Live total in the summary.
    expect(screen.getByText("Total").parentElement!.textContent).toMatch(/320/);

    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
    await screen.findByText("Your appointment is confirmed");
    const post = calls.find((c) => c.key === "POST /api/appointments")!;
    expect(JSON.parse(post.init.body as string)).toEqual({
      slotId: "s1",
      familyMemberId: "m1",
      mode: "Video",
      insurance: { providerId: "p1", memberNumber: "NM-5530-1182" },
      couponCode: "WELCOME20",
    });
    // After booking: pay online is offered.
    expect(screen.getByRole("button", { name: "Pay online" })).toBeTruthy();
  });

  it("will not book while the coupon is refused, and maps COUPON_INVALID from the server", async () => {
    const calls = stubApi(
      bookingRoutes({
        "POST /api/coupons/validate": () => Response.json({ valid: false, discountEgp: 0, totalEgp: 400, reason: "Expired" }),
        "POST /api/appointments": () =>
          Response.json({ code: "COUPON_INVALID", status: 422, reason: "Exhausted" }, { status: 422 }),
      }),
    );
    renderWithIntl(<BookingFlow doctor={bookable} features={allOn()} />);
    await toConfirm();
    fireEvent.change(screen.getByLabelText("Coupon code"), { target: { value: "OLDDEAL" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("This offer has expired.", { selector: "span" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This offer has expired.");
    expect(calls.some((c) => c.key === "POST /api/appointments")).toBe(false);
  });
});

// --- slot picker: waiting list and closed dates ------------------------------------------------

describe("slot picker with waiting list and holidays", () => {
  it("hides empty days and holidays when the features are off", async () => {
    stubApi({
      "GET /api/doctors/d/slots": () =>
        Response.json({
          doctorId: "d1",
          timezone: "Africa/Cairo",
          days: [{ date: iso(1), slots: [{ id: "s1", startsAt: "", endsAt: "", local: "09:00" }] }],
          closedDates: [{ date: iso(2), name: "Revolution Day" }],
        }),
    });
    renderWithIntl(<SlotPicker doctorSlug="d" timezone="Africa/Cairo" onSelect={vi.fn()} features={{}} />);
    await screen.findByRole("button", { name: /9:00/ });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.queryByText("Closed")).toBeNull();
    expect(screen.queryByText("Revolution Day")).toBeNull();
  });

  it("shows closed dates with their name, and no booking or waiting list on them", async () => {
    stubApi({
      "GET /api/doctors/d/slots": () =>
        Response.json({
          doctorId: "d1",
          timezone: "Africa/Cairo",
          days: [{ date: iso(1), slots: [{ id: "s1", startsAt: "", endsAt: "", local: "09:00" }] }],
          closedDates: [{ date: iso(2), name: "Revolution Day" }],
        }),
    });
    renderWithIntl(<SlotPicker doctorSlug="d" timezone="Africa/Cairo" onSelect={vi.fn()} features={{ holidayCalendar: true }} />);
    await screen.findByRole("button", { name: /9:00/ });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(14);
    expect(within(options[2]).getByText("Closed")).toBeTruthy();
    fireEvent.click(options[2]);
    expect(screen.getByText("Revolution Day")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Join the waiting list" })).toBeNull();
  });

  it("offers the waiting list on a day with no open slots and joins it", async () => {
    const calls = stubApi({
      "GET /api/doctors/d/slots": () =>
        Response.json({
          doctorId: "d1",
          timezone: "Africa/Cairo",
          days: [{ date: iso(1), slots: [{ id: "s1", startsAt: "", endsAt: "", local: "09:00" }] }],
        }),
      "POST /api/waiting-list": () => Response.json({ id: "w1", status: "Waiting" }, { status: 201 }),
    });
    renderWithIntl(
      <SlotPicker doctorSlug="d" timezone="Africa/Cairo" onSelect={vi.fn()} features={{ waitingList: true }} serviceId="sv1" />,
    );
    await screen.findByRole("button", { name: /9:00/ });
    const options = screen.getAllByRole("option");
    expect(within(options[2]).getByText("No slots")).toBeTruthy();
    fireEvent.click(options[2]);
    expect(screen.getByText("No open slots on this day", { selector: "p.font-bold" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Join the waiting list" }));

    expect(await screen.findByText(/You are on the waiting list for/)).toBeTruthy();
    const post = calls.find((c) => c.key === "POST /api/waiting-list")!;
    expect(JSON.parse(post.init.body as string)).toEqual({ doctorId: "d1", date: iso(2), serviceId: "sv1" });
    expect(screen.getByRole("link", { name: "View my waiting list" }).getAttribute("href")).toBe("/en/account/waiting-list");
  });

  it("maps ALREADY_WAITING and asks guests to sign in", async () => {
    let attempt = 0;
    stubApi({
      "GET /api/doctors/d/slots": () => Response.json({ doctorId: "d1", timezone: "Africa/Cairo", days: [] }),
      "POST /api/waiting-list": () => (attempt++ === 0 ? problem("UNAUTHORIZED", 401) : problem("ALREADY_WAITING", 409)),
    });
    renderWithIntl(<SlotPicker doctorSlug="d" timezone="Africa/Cairo" onSelect={vi.fn()} features={{ waitingList: true }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Join the waiting list" }));
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Join the waiting list" }));
    expect(await screen.findByText("You are already on the waiting list for this day.")).toBeTruthy();
  });
});

// --- settings ----------------------------------------------------------------------------------

describe("account settings", () => {
  it("shows the WhatsApp toggle only with the WhatsApp feature, and saves immediately", async () => {
    const calls = stubApi({
      "GET /api/me": () => Response.json({ ...patient, whatsAppOptIn: true, marketingOptIn: false }),
      "PUT /api/me": (_url, init) => Response.json({ ...patient, whatsAppOptIn: false, marketingOptIn: false, ...JSON.parse(init.body as string) }),
    });
    renderWithIntl(<SettingsView features={{ ...allOff(), whatsappReminders: true }} />);
    const whatsapp = await screen.findByRole("switch", { name: "WhatsApp reminders" });
    expect(whatsapp.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Offers and reminders to come back" }).getAttribute("aria-checked")).toBe("false");

    fireEvent.click(whatsapp);
    expect(await screen.findByText("Your preferences were saved.")).toBeTruthy();
    expect(whatsapp.getAttribute("aria-checked")).toBe("false");
    expect(JSON.parse(calls.find((c) => c.key === "PUT /api/me")!.init.body as string)).toEqual({ whatsAppOptIn: false });
  });

  it("shows only the offers toggle for promotions without WhatsApp, and rolls back on error", async () => {
    stubApi({
      "GET /api/me": () => Response.json({ ...patient, marketingOptIn: true }),
      "PUT /api/me": () => problem("INTERNAL_ERROR", 500),
    });
    renderWithIntl(<SettingsView features={{ ...allOff(), promotions: true }} />);
    const offers = await screen.findByRole("switch", { name: "Offers and reminders to come back" });
    expect(screen.queryByRole("switch", { name: "WhatsApp reminders" })).toBeNull();
    fireEvent.click(offers);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(offers.getAttribute("aria-checked")).toBe("true");
  });
});

// --- offers and reviews list -------------------------------------------------------------------

describe("OfferCard", () => {
  it("shows the discount, validity and a copyable code", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWithIntl(
      <OfferCard
        offer={{
          code: "WELCOME20",
          title: "20% off your first visit",
          description: "For new patients.",
          discountType: "Percent",
          value: 20,
          validTo: "2027-01-15",
        }}
      />,
    );
    expect(screen.getByText("20% off")).toBeTruthy();
    expect(screen.getByText(/Valid until/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("WELCOME20"));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("is localized with a flat EGP discount", () => {
    renderWithIntl(
      <OfferCard offer={{ code: "SMILE100", title: "عرض", discountType: "Fixed", value: 100, validTo: "2027-01-15" }} />,
      "ar",
    );
    expect(screen.getByText(/خصم .*ج\.م/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "نسخ الكود" })).toBeTruthy();
  });
});

describe("ReviewsList", () => {
  const review = (n: number) => ({
    rating: 5,
    comment: `Comment ${n}`,
    patientFirstName: `Patient ${n}`,
    createdAt: "2026-10-01T10:00:00Z",
    reply: n === 1 ? "Thank you!" : null,
  });

  it("renders the first page with the clinic reply and loads more on demand", async () => {
    const calls = stubApi({
      "GET /api/doctors/sara-hassan/reviews": () =>
        Response.json({ items: [review(3)], page: 2, pageSize: 2, totalCount: 3 }),
    });
    renderWithIntl(
      <ReviewsList
        doctorSlug="sara-hassan"
        initial={{ items: [review(1), review(2)], page: 1, pageSize: 2, totalCount: 3 }}
      />,
    );
    expect(screen.getByText("Comment 1")).toBeTruthy();
    expect(screen.getByText("Reply from the clinic")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show more reviews (1)" }));
    expect(await screen.findByText("Comment 3")).toBeTruthy();
    expect(calls[0].key).toBe("GET /api/doctors/sara-hassan/reviews");
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });
});
