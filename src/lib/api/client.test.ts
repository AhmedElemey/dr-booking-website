import { describe, expect, it, vi } from "vitest";

import { createApiClient, normalizeRecords } from "./client";
import { ApiError, couponReasonKey, errorFromResponse, errorKey } from "./errors";

function fakeFetch(response: Response) {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("createApiClient", () => {
  it("calls the same-origin proxy with the locale and no token handling", async () => {
    const fetcher = fakeFetch(Response.json({ items: [], page: 1, pageSize: 50, totalCount: 0 }));
    const api = createApiClient("ar", fetcher);

    await api.listAppointments("upcoming");

    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/appointments?scope=upcoming&page=1&pageSize=50");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers["Accept-Language"]).toBe("ar");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("posts JSON bodies for booking", async () => {
    const fetcher = fakeFetch(Response.json({ id: "a1" }, { status: 201 }));
    const api = createApiClient("en", fetcher);

    await api.bookAppointment({ slotId: "s1", patientNote: "hi" });

    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/appointments");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ slotId: "s1", patientNote: "hi" });
  });

  it("routes OTP calls through /api/auth", async () => {
    const fetcher = fakeFetch(new Response(null, { status: 204 }));
    await createApiClient("ar", fetcher).requestOtp("+201012345678");
    expect((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "/api/auth/otp/request",
    );
  });

  it("surfaces API problems as ApiError", async () => {
    const fetcher = fakeFetch(
      Response.json({ code: "SLOT_TAKEN", detail: "taken" }, { status: 409 }),
    );
    const error = await createApiClient("ar", fetcher)
      .bookAppointment({ slotId: "s1" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("SLOT_TAKEN");
  });
});

type Call = [string, RequestInit & { headers: Record<string, string>; body?: string }];
const lastCall = (fetcher: unknown): Call =>
  (fetcher as ReturnType<typeof vi.fn>).mock.calls.at(-1) as Call;

const repeatFetch = (body: unknown, status = 200) =>
  vi.fn(async () => Response.json(body, { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

describe("phase-2 endpoints", () => {
  it("sends the optional booking fields exactly as the contract names them", async () => {
    const fetcher = repeatFetch({ id: "a1" }, 201);
    await createApiClient("ar", fetcher).bookAppointment({
      slotId: "s1",
      serviceId: "sv1",
      familyMemberId: "m1",
      mode: "Video",
      insurance: { providerId: "p1", memberNumber: "NM-1" },
      couponCode: "WELCOME20",
    });
    expect(JSON.parse(lastCall(fetcher)[1].body!)).toEqual({
      slotId: "s1",
      serviceId: "sv1",
      familyMemberId: "m1",
      mode: "Video",
      insurance: { providerId: "p1", memberNumber: "NM-1" },
      couponCode: "WELCOME20",
    });
  });

  it("manages family members under /me/family", async () => {
    const fetcher = repeatFetch([]);
    const api = createApiClient("en", fetcher);
    await api.listFamily();
    expect(lastCall(fetcher)[0]).toBe("/api/me/family");
    await api.addFamilyMember({ fullName: "Yassin", relation: "Child" });
    expect(lastCall(fetcher)[1].method).toBe("POST");
    await api.updateFamilyMember("m1", { fullName: "Yassin A.", relation: "Child" });
    expect(lastCall(fetcher)[0]).toBe("/api/me/family/m1");
    expect(lastCall(fetcher)[1].method).toBe("PUT");
    await api.deleteFamilyMember("m1");
    expect(lastCall(fetcher)[1].method).toBe("DELETE");
  });

  it("joins, lists and leaves the waiting list", async () => {
    const fetcher = repeatFetch({ id: "w1" }, 201);
    const api = createApiClient("en", fetcher);
    await api.joinWaitingList({ doctorId: "d1", date: "2026-11-20" });
    expect(lastCall(fetcher)[0]).toBe("/api/waiting-list");
    expect(JSON.parse(lastCall(fetcher)[1].body!)).toEqual({ doctorId: "d1", date: "2026-11-20" });
    await api.listWaitingList();
    expect(lastCall(fetcher)[1].method).toBe("GET");
    await api.leaveWaitingList("w1");
    expect(lastCall(fetcher)).toEqual(["/api/waiting-list/w1", expect.objectContaining({ method: "DELETE" })]);
  });

  it("starts a payment with the return URL and reads it back", async () => {
    const fetcher = repeatFetch({ paymentId: "p1", checkoutUrl: "https://pay.example/c" });
    const api = createApiClient("en", fetcher);
    await api.startPayment("a1", "https://site.example/en/appointments/a1?payment=return");
    expect(lastCall(fetcher)[0]).toBe("/api/appointments/a1/pay");
    expect(JSON.parse(lastCall(fetcher)[1].body!)).toEqual({
      returnUrl: "https://site.example/en/appointments/a1?payment=return",
    });
    await api.getPayment("p1");
    expect(lastCall(fetcher)[0]).toBe("/api/payments/p1");
  });

  it("validates coupons, rates visits, asks for video access and reviews pages", async () => {
    const fetcher = repeatFetch({});
    const api = createApiClient("en", fetcher);
    await api.validateCoupon({ code: "SMILE100", doctorId: "d1", serviceId: "sv1" });
    expect(lastCall(fetcher)[0]).toBe("/api/coupons/validate");
    expect(JSON.parse(lastCall(fetcher)[1].body!)).toEqual({ code: "SMILE100", doctorId: "d1", serviceId: "sv1" });
    await api.reviewAppointment("a1", { rating: 5, comment: "Great" });
    expect(lastCall(fetcher)[0]).toBe("/api/appointments/a1/review");
    await api.getVideoAccess("a1");
    expect(lastCall(fetcher)[0]).toBe("/api/appointments/a1/video");
    await api.getDoctorReviews("sara-hassan", 2);
    expect(lastCall(fetcher)[0]).toBe("/api/doctors/sara-hassan/reviews?page=2");
  });

  it("sends the opt-in toggles with PUT /me", async () => {
    const fetcher = repeatFetch({ id: "u1" });
    await createApiClient("en", fetcher).updateMe({ whatsAppOptIn: false, marketingOptIn: true });
    expect(lastCall(fetcher)[0]).toBe("/api/me");
    expect(JSON.parse(lastCall(fetcher)[1].body!)).toEqual({ whatsAppOptIn: false, marketingOptIn: true });
  });

  it("scopes my records to a family member", async () => {
    const fetcher = repeatFetch({ medicalInfo: null, entries: [] });
    const api = createApiClient("en", fetcher);
    await api.getMyRecords();
    expect(lastCall(fetcher)[0]).toBe("/api/me/records");
    await api.getMyRecords("m 1");
    expect(lastCall(fetcher)[0]).toBe("/api/me/records?familyMemberId=m%201");
  });
});

describe("normalizeRecords", () => {
  it("keeps medical info and the entries meant for the patient", () => {
    const records = normalizeRecords({
      medicalInfo: { bloodType: "O+" },
      entries: [
        { id: "e1", kind: "Note", title: "Visible", createdAt: "2026-11-01T00:00:00Z" },
        { id: "e2", kind: "Note", title: "Hidden", visibleToPatient: false, createdAt: "2026-11-01T00:00:00Z" },
        { nonsense: true },
      ],
    });
    expect(records.medicalInfo).toEqual({ bloodType: "O+" });
    expect(records.entries.map((e) => e.id)).toEqual(["e1"]);
  });

  it("accepts a `records` list and tolerates garbage", () => {
    expect(normalizeRecords({ records: [{ id: "e1", title: "T" }] }).entries).toHaveLength(1);
    expect(normalizeRecords(null)).toEqual({ medicalInfo: null, entries: [] });
    expect(normalizeRecords({ entries: "x", medicalInfo: 3 })).toEqual({ medicalInfo: null, entries: [] });
  });
});

describe("phase-2 error codes", () => {
  it("maps every new code to its own message key", async () => {
    for (const code of [
      "CLINIC_CLOSED",
      "COUPON_INVALID",
      "ALREADY_REVIEWED",
      "NOT_REVIEWABLE",
      "PAYMENT_NOT_ALLOWED",
      "VIDEO_NOT_OPEN",
      "ALREADY_WAITING",
      "PROVIDER_ERROR",
    ]) {
      const error = await errorFromResponse(Response.json({ code }, { status: 409 }));
      expect(errorKey(error)).toBe(code);
    }
  });

  it("carries the COUPON_INVALID reason", async () => {
    const error = await errorFromResponse(
      Response.json({ code: "COUPON_INVALID", reason: "Expired" }, { status: 422 }),
    );
    expect(error.reason).toBe("Expired");
    expect(couponReasonKey(error)).toBe("Expired");
    expect(couponReasonKey("Exhausted")).toBe("Exhausted");
    expect(couponReasonKey("Something new")).toBe("Unknown");
    expect(couponReasonKey(undefined)).toBe("Unknown");
  });
});
