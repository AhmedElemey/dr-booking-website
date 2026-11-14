import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  Appointment,
  CouponCheck,
  DoctorProfile,
  FamilyMember,
  Paged,
  Payment,
  Promotion,
  Review,
  SlotsResponse,
  WaitingEntry,
} from "../types";
import { handleMockRequest, mockFeatures, resetMockState } from "./backend";

// Sunday mid-morning in Cairo, so the next days have open slots.
const NOW = new Date("2026-11-01T08:00:00Z");
const AUTH = { authorization: "Bearer mock-access-1", "accept-language": "en" };

const call = (path: string, init: RequestInit = {}, now = NOW) => handleMockRequest(path, init, now);
const get = (path: string) => call(path, { headers: AUTH });
const send = (method: string, path: string, body?: unknown, now = NOW) =>
  call(path, { method, headers: { "content-type": "application/json", ...AUTH }, body: JSON.stringify(body ?? {}) }, now);
const json = async <T,>(res: Response) => (await res.json()) as T;

async function slotsOf(slug: string, from = "2026-11-02", to = "2026-11-14") {
  return json<SlotsResponse>(await get(`/doctors/${slug}/slots?from=${from}&to=${to}`));
}

beforeEach(() => resetMockState());
afterEach(() => {
  delete process.env.MOCK_FEATURES;
});

describe("demo feature switches", () => {
  it("turns all 13 phase-2 features on and lets MOCK_FEATURES switch one off", async () => {
    expect(Object.values(mockFeatures()).filter(Boolean).length).toBeGreaterThanOrEqual(13);
    process.env.MOCK_FEATURES = '{"reviews":false}';
    expect(mockFeatures().reviews).toBe(false);
    expect(mockFeatures().promotions).toBe(true);
  });

  it("answers 403 FEATURE_DISABLED with the feature name when a feature is off", async () => {
    process.env.MOCK_FEATURES = '{"familyAccounts":false,"waitingList":false,"promotions":false,"patientRecords":false}';
    for (const [path, feature] of [
      ["/me/family", "familyAccounts"],
      ["/waiting-list", "waitingList"],
      ["/me/records", "patientRecords"],
    ] as const) {
      const res = await get(path);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: "FEATURE_DISABLED", feature });
    }
    expect((await call("/promotions")).status).toBe(403);
  });
});

describe("catalog extras", () => {
  it("adds rating, offersVideo and accepted insurers to doctors, and hides them when off", async () => {
    const doctor = await json<DoctorProfile>(await call("/doctors/omar-farouk", { headers: AUTH }));
    expect(doctor.rating).toEqual({ average: 4.5, count: 2 });
    expect(doctor.offersVideo).toBe(true);
    expect(doctor.insuranceProviders?.map((p) => p.name)).toEqual(["Nile Medical Insurance"]);

    process.env.MOCK_FEATURES = '{"reviews":false,"videoConsultation":false,"insurance":false}';
    const off = await json<DoctorProfile>(await call("/doctors/omar-farouk", { headers: AUTH }));
    expect(off.rating).toBeNull();
    expect(off.offersVideo).toBe(false);
    expect(off.insuranceProviders).toEqual([]);
  });

  it("filters doctors by accepted insurance provider", async () => {
    const providers = await json<{ id: string }[]>(await call("/insurance-providers"));
    const nile = providers[1].id;
    const result = await json<Paged<{ slug: string }>>(await call(`/doctors?insuranceProviderId=${nile}`));
    expect(result.items.map((d) => d.slug)).toEqual(["sara-hassan", "omar-farouk"]);
  });

  it("lists published reviews, newest first, five per page", async () => {
    const page1 = await json<Paged<Review>>(await get("/doctors/sara-hassan/reviews"));
    expect(page1.totalCount).toBe(6);
    expect(page1.items).toHaveLength(5);
    expect(page1.items[0].patientFirstName).toBe("Mohamed");
    const page2 = await json<Paged<Review>>(await get("/doctors/sara-hassan/reviews?page=2"));
    expect(page2.items).toHaveLength(1);
  });

  it("serves public offers that are currently valid", async () => {
    const offers = await json<Promotion[]>(await call("/promotions", { headers: { "accept-language": "ar" } }));
    expect(offers.map((o) => o.code)).toEqual(["WELCOME20", "SMILE100", "KIDS15"]);
    expect(offers[0].title).toContain("٢٠");
  });

  it("shows closed dates with names and removes slots on them", async () => {
    const slots = await slotsOf("mona-adel", "2026-11-02", "2026-11-14");
    expect(slots.closedDates).toEqual([{ date: "2026-11-06", name: "Clinic closed: annual inventory" }]);
    expect(slots.days.some((d) => d.date === "2026-11-06")).toBe(false);
    process.env.MOCK_FEATURES = '{"holidayCalendar":false}';
    const off = await slotsOf("mona-adel", "2026-11-02", "2026-11-14");
    expect(off.closedDates).toBeUndefined();
    expect(off.days.some((d) => d.date === "2026-11-06")).toBe(true);
  });
});

describe("family accounts", () => {
  it("creates, updates and deletes members, with validation", async () => {
    const created = await send("POST", "/me/family", { fullName: "Laila Mostafa", relation: "Child", gender: "Female" });
    expect(created.status).toBe(201);
    const member = await json<FamilyMember>(created);
    expect(member).toMatchObject({ fullName: "Laila Mostafa", relation: "Child", gender: "Female" });

    expect((await send("POST", "/me/family", { fullName: "", relation: "Child" })).status).toBe(422);
    expect((await send("POST", "/me/family", { fullName: "X", relation: "Cousin" })).status).toBe(422);

    const updated = await json<FamilyMember>(await send("PUT", `/me/family/${member.id}`, { fullName: "Laila M.", relation: "Child" }));
    expect(updated.fullName).toBe("Laila M.");
    expect((await send("DELETE", `/me/family/${member.id}`)).status).toBe(204);
    expect((await send("DELETE", `/me/family/${member.id}`)).status).toBe(404);
  });

  it("books for a member, shows them on the appointment and counts the limit per person", async () => {
    const family = await json<FamilyMember[]>(await get("/me/family"));
    const child = family[0];
    const sara = await slotsOf("sara-hassan");
    const days = sara.days.filter((d) => d.date !== "2026-11-04" && d.date !== "2026-11-06");

    const booked = await send("POST", "/appointments", { slotId: days[2].slots[0].id, familyMemberId: child.id });
    expect(booked.status).toBe(201);
    expect((await json<Appointment>(booked)).familyMember).toMatchObject({ id: child.id, relation: "Child" });

    // The child already has one upcoming visit (Dr. Mona); two more reach the limit of three for that person only.
    const second = await send("POST", "/appointments", { slotId: days[3].slots[0].id, familyMemberId: child.id });
    expect(second.status).toBe(201);
    const third = await send("POST", "/appointments", { slotId: days[4].slots[0].id, familyMemberId: child.id });
    expect((await json<{ code: string }>(third)).code).toBe("BOOKING_LIMIT");
    // The owner still has room.
    const own = await send("POST", "/appointments", { slotId: days[4].slots[0].id });
    expect(own.status).toBe(201);
  });

  it("ignores familyMemberId when the feature is off", async () => {
    process.env.MOCK_FEATURES = '{"familyAccounts":false}';
    const slots = await slotsOf("mona-adel");
    const res = await send("POST", "/appointments", { slotId: slots.days[3].slots[0].id, familyMemberId: "whatever" });
    expect(res.status).toBe(201);
    expect((await json<Appointment>(res)).familyMember).toBeNull();
  });
});

describe("waiting list", () => {
  it("joins once per doctor, date and person, lists and leaves", async () => {
    const sara = await json<DoctorProfile>(await call("/doctors/sara-hassan", { headers: AUTH }));
    const join = await send("POST", "/waiting-list", { doctorId: sara.id, date: "2026-11-06" });
    expect(join.status).toBe(201);
    const entry = await json<WaitingEntry>(join);
    expect(entry).toMatchObject({ status: "Waiting", date: "2026-11-06", doctor: { slug: "sara-hassan" } });

    const again = await send("POST", "/waiting-list", { doctorId: sara.id, date: "2026-11-06" });
    expect(again.status).toBe(409);
    expect((await json<{ code: string }>(again)).code).toBe("ALREADY_WAITING");

    const list = await json<WaitingEntry[]>(await get("/waiting-list"));
    expect(list.map((e) => e.status)).toContain("Waiting");
    expect((await send("DELETE", `/waiting-list/${entry.id}`)).status).toBe(204);
  });

  it("notifies waiting patients when a booked slot is cancelled", async () => {
    const upcoming = await json<Paged<Appointment>>(await get("/appointments?scope=upcoming"));
    const target = upcoming.items.find((a) => a.doctor.slug === "sara-hassan")!;
    const date = target.startsAtLocal.slice(0, 10);
    await send("POST", "/waiting-list", { doctorId: target.doctor.id, date });
    await send("POST", `/appointments/${target.id}/cancel`, {});
    const list = await json<WaitingEntry[]>(await get("/waiting-list"));
    const entry = list.find((e) => e.doctor.id === target.doctor.id && e.date === date)!;
    expect(entry.status).toBe("Notified");
    expect(entry.notifiedAt).toBeTruthy();
  });
});

describe("promotions and coupons", () => {
  const validate = async (body: object) =>
    json<CouponCheck>(await send("POST", "/coupons/validate", body));

  it("validates a code and returns the discount and new total", async () => {
    const sara = await json<DoctorProfile>(await call("/doctors/sara-hassan", { headers: AUTH }));
    const cleaning = sara.services[1];
    expect(await validate({ code: "smile100", doctorId: sara.id, serviceId: cleaning.id })).toEqual({
      valid: true,
      discountEgp: 100,
      totalEgp: 350,
    });
    expect(await validate({ code: "WELCOME20", doctorId: sara.id, serviceId: cleaning.id })).toMatchObject({
      valid: true,
      discountEgp: 90,
    });
  });

  it("explains why a code is refused", async () => {
    const [sara, , mona] = await Promise.all(
      ["sara-hassan", "omar-farouk", "mona-adel"].map(async (s) => json<DoctorProfile>(await call(`/doctors/${s}`, { headers: AUTH }))),
    );
    expect((await validate({ code: "NOPE", doctorId: sara.id })).reason).toBe("NotFound");
    expect((await validate({ code: "OLDDEAL", doctorId: sara.id })).reason).toBe("Expired");
    expect((await validate({ code: "KIDS15", doctorId: sara.id })).reason).toBe("NotApplicable");
    expect((await validate({ code: "KIDS15", doctorId: mona.id })).valid).toBe(true);
    // SMILE100 is already used once by the demo patient and allows two uses.
    expect((await validate({ code: "SMILE100", doctorId: sara.id, serviceId: sara.services[1].id })).valid).toBe(true);
  });

  it("applies the coupon at booking, rejects a bad one with reason, and releases it on cancel", async () => {
    const sara = await json<DoctorProfile>(await call("/doctors/sara-hassan", { headers: AUTH }));
    const slots = await slotsOf("sara-hassan");
    const slot = slots.days.find((d) => d.date === "2026-11-05")!.slots[0];
    const bad = await send("POST", "/appointments", { slotId: slot.id, couponCode: "NOPE" });
    expect(bad.status).toBe(422);
    expect(await bad.json()).toMatchObject({ code: "COUPON_INVALID", reason: "NotFound" });

    const ok = await send("POST", "/appointments", { slotId: slot.id, serviceId: sara.services[1].id, couponCode: "SMILE100" });
    expect(ok.status).toBe(201);
    const appt = await json<Appointment>(ok);
    expect(appt).toMatchObject({ priceEgp: 450, discountEgp: 100, totalEgp: 350, paymentStatus: "Unpaid" });

    // Used twice now, so a third try hits the per-patient limit; cancelling frees one use.
    const limit = await validate({ code: "SMILE100", doctorId: sara.id, serviceId: sara.services[1].id });
    expect(limit.reason).toBe("PerPatientLimit");
    await send("POST", `/appointments/${appt.id}/cancel`, {});
    expect((await validate({ code: "SMILE100", doctorId: sara.id, serviceId: sara.services[1].id })).valid).toBe(true);
  });
});

describe("insurance and video at booking", () => {
  it("stores the insurance request as Pending and refuses a provider the doctor does not accept", async () => {
    const providers = await json<{ id: string; name: string }[]>(await call("/insurance-providers"));
    const slots = await slotsOf("sara-hassan");
    const slot = slots.days.find((d) => d.date === "2026-11-05")!.slots[0];
    const delta = providers[2];
    const refused = await send("POST", "/appointments", { slotId: slot.id, insurance: { providerId: delta.id, memberNumber: "D-1" } });
    expect(refused.status).toBe(422);

    const ok = await send("POST", "/appointments", { slotId: slot.id, insurance: { providerId: providers[0].id, memberNumber: "MC-1" } });
    expect((await json<Appointment>(ok)).insurance).toMatchObject({
      provider: { name: "Misr Care Health Insurance" },
      memberNumber: "MC-1",
      status: "Pending",
    });
  });

  it("books a video visit only with a doctor that offers it", async () => {
    const sara = await slotsOf("sara-hassan");
    const refused = await send("POST", "/appointments", { slotId: sara.days[1].slots[0].id, mode: "Video" });
    expect(refused.status).toBe(422);
    const omar = await slotsOf("omar-farouk");
    const slot = omar.days.find((d) => d.date === "2026-11-07")!.slots[0];
    const ok = await send("POST", "/appointments", { slotId: slot.id, mode: "Video" });
    expect((await json<Appointment>(ok)).mode).toBe("Video");
  });

  it("opens the video room 15 minutes before the start until 30 minutes after the end", async () => {
    const upcoming = await json<Paged<Appointment>>(await get("/appointments?scope=upcoming"));
    const video = upcoming.items.find((a) => a.mode === "Video")!;
    const start = new Date(video.startsAt).getTime();
    const early = await send("GET", `/appointments/${video.id}/video`, undefined, new Date(start - 20 * 60_000));
    expect(early.status).toBe(409);
    expect((await json<{ code: string }>(early)).code).toBe("VIDEO_NOT_OPEN");
    const open = await send("GET", `/appointments/${video.id}/video`, undefined, new Date(start - 10 * 60_000));
    expect(open.status).toBe(200);
    expect(await json<{ joinUrl: string }>(open)).toMatchObject({ joinUrl: expect.stringMatching(/^https:\/\/meet\.jit\.si\//) });
  });
});

describe("online payments", () => {
  it("pays an unpaid appointment: checkout URL carries the return URL, polling settles it", async () => {
    const upcoming = await json<Paged<Appointment>>(await get("/appointments?scope=upcoming"));
    const target = upcoming.items.find((a) => a.paymentStatus === "Unpaid" && (a.totalEgp ?? 0) > 0)!;
    const returnUrl = `https://site.example/en/appointments/${target.id}?payment=return`;
    const start = await send("POST", `/appointments/${target.id}/pay`, { returnUrl });
    expect(start.status).toBe(200);
    const { paymentId, checkoutUrl } = await json<{ paymentId: string; checkoutUrl: string }>(start);
    expect(checkoutUrl.startsWith(`${returnUrl}&paymentId=${paymentId}`)).toBe(true);

    expect((await json<Payment>(await get(`/payments/${paymentId}`))).status).toBe("Pending");
    expect((await json<Payment>(await get(`/payments/${paymentId}`))).status).toBe("Paid");
    expect((await json<Appointment>(await get(`/appointments/${target.id}`))).paymentStatus).toBe("Paid");

    const again = await send("POST", `/appointments/${target.id}/pay`, { returnUrl });
    expect((await json<{ code: string }>(again)).code).toBe("PAYMENT_NOT_ALLOWED");
  });

  it("refuses payment for completed visits and unknown payments", async () => {
    const past = await json<Paged<Appointment>>(await get("/appointments?scope=past"));
    const res = await send("POST", `/appointments/${past.items[0].id}/pay`, { returnUrl: "https://site.example/x" });
    expect(res.status).toBe(409);
    expect((await get("/payments/missing")).status).toBe(404);
  });

  it("refunds a paid visit that the patient cancels", async () => {
    const upcoming = await json<Paged<Appointment>>(await get("/appointments?scope=upcoming"));
    const paid = upcoming.items.find((a) => a.paymentStatus === "Paid")!;
    const cancelled = await json<Appointment>(await send("POST", `/appointments/${paid.id}/cancel`, {}));
    expect(cancelled.paymentStatus).toBe("Refunded");
  });
});

describe("reviews", () => {
  it("lets a completed visit be rated once and updates the doctor's rating", async () => {
    const past = await json<Paged<Appointment>>(await get("/appointments?scope=past"));
    const reviewable = past.items.find((a) => a.canReview)!;
    expect(reviewable.doctor.slug).toBe("sara-hassan");

    expect((await send("POST", `/appointments/${reviewable.id}/review`, { rating: 9 })).status).toBe(422);
    const ok = await send("POST", `/appointments/${reviewable.id}/review`, { rating: 3, comment: "Fine" });
    expect(ok.status).toBe(201);
    expect(await json<Appointment>(ok)).toMatchObject({ canReview: false, review: { rating: 3, comment: "Fine" } });

    const again = await send("POST", `/appointments/${reviewable.id}/review`, { rating: 5 });
    expect((await json<{ code: string }>(again)).code).toBe("ALREADY_REVIEWED");
    const doctor = await json<DoctorProfile>(await call("/doctors/sara-hassan", { headers: AUTH }));
    expect(doctor.rating?.count).toBe(7);
  });

  it("refuses to rate a visit that is not completed", async () => {
    const upcoming = await json<Paged<Appointment>>(await get("/appointments?scope=upcoming"));
    const res = await send("POST", `/appointments/${upcoming.items[0].id}/review`, { rating: 5 });
    expect((await json<{ code: string }>(res)).code).toBe("NOT_REVIEWABLE");
  });
});

describe("records and preferences", () => {
  it("returns own medical info and the visible entries, scoped to a member on request", async () => {
    const own = await json<{ medicalInfo: { bloodType: string }; entries: unknown[] }>(await get("/me/records"));
    expect(own.medicalInfo.bloodType).toBe("O+");
    expect(own.entries).toHaveLength(3);
    const family = await json<FamilyMember[]>(await get("/me/family"));
    const child = await json<{ entries: unknown[] }>(await get(`/me/records?familyMemberId=${family[0].id}`));
    expect(child.entries).toHaveLength(1);
    expect((await get("/me/records?familyMemberId=nope")).status).toBe(404);
  });

  it("stores the WhatsApp and offers opt-ins on the profile", async () => {
    const me = await json<{ whatsAppOptIn: boolean; marketingOptIn: boolean }>(await get("/me"));
    expect(me).toMatchObject({ whatsAppOptIn: true, marketingOptIn: true });
    const updated = await json<typeof me>(await send("PUT", "/me", { whatsAppOptIn: false }));
    expect(updated).toMatchObject({ whatsAppOptIn: false, marketingOptIn: true });
  });
});
