import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isMockApi } from "../config";
import type { Appointment, DoctorProfile, Paged, SlotsResponse } from "../types";
import { handleMockRequest, resetMockState } from "./backend";

// Mid-morning Cairo time on a Sunday so the next days have open slots.
const NOW = new Date("2026-11-01T08:00:00Z");
const AUTH = { authorization: "Bearer mock-access-1" };

async function call(path: string, init: RequestInit = {}) {
  return handleMockRequest(path, init, NOW);
}

async function post(path: string, body: unknown, headers: Record<string, string> = AUTH) {
  return call(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function openSlots(slug: string, from = "2026-11-02", to = "2026-11-08") {
  const res = await call(`/doctors/${slug}/slots?from=${from}&to=${to}`);
  return (await res.json()) as SlotsResponse;
}

describe("MOCK_API flag", () => {
  const original = process.env.MOCK_API;
  afterEach(() => {
    if (original === undefined) delete process.env.MOCK_API;
    else process.env.MOCK_API = original;
  });

  it("is off unless MOCK_API=1 is set explicitly", () => {
    delete process.env.MOCK_API;
    expect(isMockApi()).toBe(false);
    process.env.MOCK_API = "true";
    expect(isMockApi()).toBe(false);
    process.env.MOCK_API = "1";
    expect(isMockApi()).toBe(true);
  });
});

describe("mock backend", () => {
  beforeEach(() => resetMockState());

  it("serves a Cairo clinic with three doctors, localized by Accept-Language", async () => {
    const ar = (await (await call("/doctors", { headers: { "accept-language": "ar" } })).json()) as Paged<{ name: string; clinic: { city: string } }>;
    const en = (await (await call("/doctors", { headers: { "accept-language": "en" } })).json()) as typeof ar;

    expect(ar.totalCount).toBe(3);
    expect(ar.items[0].name).toBe("د. سارة حسن");
    expect(en.items[0].name).toBe("Dr. Sara Hassan");
    expect(en.items[0].clinic.city).toBe("Cairo");
  });

  it("filters by specialty and name", async () => {
    const specialties = (await (await call("/specialties")).json()) as { id: string }[];
    const bySpecialty = (await (await call(`/doctors?specialtyId=${specialties[1].id}`)).json()) as Paged<unknown>;
    expect(bySpecialty.totalCount).toBe(1);
    const byName = (await (await call("/doctors?q=mona", { headers: { "accept-language": "en" } })).json()) as Paged<unknown>;
    expect(byName.totalCount).toBe(1);
  });

  it("returns a doctor profile with clinic timezone and services, and 404s unknown slugs", async () => {
    const profile = (await (await call("/doctors/sara-hassan", { headers: { "accept-language": "en" } })).json()) as DoctorProfile;
    expect(profile.clinic.timezone).toBe("Africa/Cairo");
    expect(profile.services.length).toBeGreaterThan(0);

    const missing = await call("/doctors/nobody");
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe("NOT_FOUND");
  });

  it("offers a week of open slots with clinic-local labels", async () => {
    const slots = await openSlots("sara-hassan");
    expect(slots.timezone).toBe("Africa/Cairo");
    expect(slots.days.length).toBeGreaterThanOrEqual(5);
    expect(slots.days[0].slots[0].local).toBe("09:00");
  });

  it("requires a token for patient endpoints", async () => {
    expect((await call("/me")).status).toBe(401);
    expect((await call("/appointments")).status).toBe(401);
  });

  it("logs in with the fixed code only", async () => {
    expect((await post("/auth/otp/verify", { phone: "+201012345678", code: "000000" }, {})).status).toBe(400);
    const ok = await post("/auth/otp/verify", { phone: "+201012345678", code: "123456" }, {});
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ expiresIn: 900, user: { role: "Patient" } });
  });

  it("starts the demo patient with three appointments", async () => {
    const upcoming = (await (await call("/appointments?scope=upcoming", { headers: AUTH })).json()) as Paged<Appointment>;
    const past = (await (await call("/appointments?scope=past", { headers: AUTH })).json()) as Paged<Appointment>;
    expect(upcoming.totalCount).toBe(2);
    expect(past.totalCount).toBe(1);
    expect(upcoming.items[0]).toMatchObject({ status: "Confirmed", timezone: "Africa/Cairo" });
    expect(upcoming.items[0].startsAtLocal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+0[23]:00$/);
  });

  it("books a slot once, then reports SLOT_TAKEN and BOOKING_LIMIT", async () => {
    const mona = await openSlots("mona-adel");
    const [first, second] = [mona.days[0].slots[0], mona.days[1].slots[0]];

    const booked = await post("/appointments", { slotId: first.id });
    expect(booked.status).toBe(201);
    expect((await booked.json()).status).toBe("Confirmed");

    const again = await post("/appointments", { slotId: first.id });
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("SLOT_TAKEN");

    // Third upcoming appointment reached, so a fourth is refused.
    const limit = await post("/appointments", { slotId: second.id });
    expect(limit.status).toBe(409);
    expect((await limit.json()).code).toBe("BOOKING_LIMIT");
  });

  it("cancels, frees the slot and enforces the cancel window", async () => {
    const upcoming = (await (await call("/appointments?scope=upcoming", { headers: AUTH })).json()) as Paged<Appointment>;
    const target = upcoming.items[0];

    const cancelled = await post(`/appointments/${target.id}/cancel`, { reason: "busy" });
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toMatchObject({ status: "Cancelled", cancelledBy: "Patient", cancelReason: "busy" });

    const again = await post(`/appointments/${target.id}/cancel`, {});
    expect((await again.json()).code).toBe("INVALID_TRANSITION");

    const late = await handleMockRequest(
      `/appointments/${upcoming.items[1].id}/cancel`,
      { method: "POST", headers: AUTH, body: "{}" },
      new Date(new Date(upcoming.items[1].startsAt).getTime() - 30 * 60_000),
    );
    expect((await late.json()).code).toBe("CANCEL_WINDOW_PASSED");
  });

  it("reschedules to another open slot of the same doctor", async () => {
    const upcoming = (await (await call("/appointments?scope=upcoming", { headers: AUTH })).json()) as Paged<Appointment>;
    const target = upcoming.items[0];
    const slots = await openSlots(target.doctor.slug);
    const next = slots.days[slots.days.length - 1].slots[0];

    const moved = await post(`/appointments/${target.id}/reschedule`, { slotId: next.id });
    expect(moved.status).toBe(200);
    expect((await moved.json()).slotId).toBe(next.id);
  });
});

describe("mock backend request bodies", () => {
  beforeEach(() => resetMockState());

  it("reads ArrayBuffer bodies, as forwarded by the cookie proxy", async () => {
    const slots = await openSlots("mona-adel");
    const body = new TextEncoder().encode(JSON.stringify({ slotId: slots.days[0].slots[0].id })).buffer;
    const res = await call("/appointments", { method: "POST", headers: AUTH, body });
    expect(res.status).toBe(201);
  });
});
