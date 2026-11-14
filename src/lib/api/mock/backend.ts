import {
  addDays,
  toLocalIso,
  toLocalIsoWithOffset,
  todayInZone,
  zonedTimeToUtc,
} from "../../datetime";
import { clinicConfig, FEATURE_KEYS, type Features } from "../../clinic-config";
import { clinic, doctors, MOCK_OTP, MOCK_TIMEZONE, patient, specialties } from "./fixtures";
import type { MockDoctor } from "./fixtures";

// In-memory stand-in for the Moonlight API (MOCK_API=1). It follows the spec's
// contract closely enough for the website to be demoed without the backend:
// localized public reads, OTP login, booking rules and problem+json errors.

type Lang = "ar" | "en";
type SlotStatus = "Open" | "Reserved" | "Blocked";
type MockSlot = {
  id: string;
  doctorId: string;
  startsAt: Date;
  endsAt: Date;
  status: SlotStatus;
};
type MockAppointment = {
  id: string;
  slotId: string;
  status: "Confirmed" | "Cancelled" | "Completed" | "NoShow";
  serviceId?: string;
  patientNote?: string;
  cancelledBy?: "Patient";
  cancelReason?: string;
};

type MockState = {
  slots: MockSlot[];
  appointments: MockAppointment[];
  generatedDays: Set<string>;
  seeded: boolean;
  profile: { fullName: string | null; preferredLanguage: Lang };
  nextId: number;
};

const MIN_LEAD_MINUTES = 60;
const CANCEL_WINDOW_HOURS = 2;
const MAX_UPCOMING = 3;
const DAYS_AHEAD = 10;
const SLOT_MINUTES = 30;

const globalStore = globalThis as unknown as { __moonlightMock?: MockState };

function state(): MockState {
  globalStore.__moonlightMock ??= {
    slots: [],
    appointments: [],
    generatedDays: new Set(),
    seeded: false,
    profile: { fullName: patient.fullName, preferredLanguage: patient.preferredLanguage },
    nextId: 1,
  };
  return globalStore.__moonlightMock;
}

/** Test hook: forget all demo state. */
export function resetMockState() {
  globalStore.__moonlightMock = undefined;
}

function newId(prefix: string): string {
  const s = state();
  const n = String(s.nextId++).padStart(12, "0");
  return `${prefix}0000000-0000-4000-8000-${n}`;
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function generateSlots(now: Date) {
  const s = state();
  const today = todayInZone(MOCK_TIMEZONE, now);
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    if (s.generatedDays.has(date)) continue;
    s.generatedDays.add(date);
    for (const doctor of doctors) {
      if (doctor.closedWeekday === weekdayOf(date)) continue;
      let n = 0;
      for (const window of doctor.windows) {
        let cursor = window.from;
        while (cursor < window.to) {
          const [h, m] = cursor.split(":").map(Number);
          const endMinutes = h * 60 + m + SLOT_MINUTES;
          const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
          if (end > window.to) break;
          const startsAt = zonedTimeToUtc(date, cursor, MOCK_TIMEZONE);
          s.slots.push({
            id: newId("5"),
            doctorId: doctor.id,
            startsAt,
            endsAt: new Date(startsAt.getTime() + SLOT_MINUTES * 60_000),
            // Every fifth slot is already taken by someone else.
            status: n % 5 === 3 ? "Reserved" : "Open",
          });
          n++;
          cursor = end;
        }
      }
    }
  }
}

function seed(now: Date) {
  const s = state();
  if (s.seeded) return;
  s.seeded = true;
  const today = todayInZone(MOCK_TIMEZONE, now);

  const reserveAt = (doctor: MockDoctor, dayOffset: number, hhmm: string) => {
    const startsAt = zonedTimeToUtc(addDays(today, dayOffset), hhmm, MOCK_TIMEZONE);
    let slot = s.slots.find(
      (x) => x.doctorId === doctor.id && x.startsAt.getTime() === startsAt.getTime(),
    );
    if (!slot) {
      slot = {
        id: newId("5"),
        doctorId: doctor.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + SLOT_MINUTES * 60_000),
        status: "Reserved",
      };
      s.slots.push(slot);
    }
    slot.status = "Reserved";
    return slot;
  };

  const upcoming1 = reserveAt(doctors[0], 2, "11:00");
  const upcoming2 = reserveAt(doctors[1], 4, "17:00");
  const past = reserveAt(doctors[2], -12, "10:30");
  s.appointments.push(
    {
      id: newId("f"),
      slotId: upcoming1.id,
      status: "Confirmed",
      serviceId: doctors[0].services[0].id,
    },
    {
      id: newId("f"),
      slotId: upcoming2.id,
      status: "Confirmed",
      serviceId: doctors[1].services[0].id,
      patientNote: "Wisdom tooth discomfort",
    },
    { id: newId("f"), slotId: past.id, status: "Completed", serviceId: doctors[2].services[0].id },
  );
}

function ensureReady(now: Date) {
  generateSlots(now);
  seed(now);
}

const PROBLEM_TEXT: Record<string, { status: number; ar: string; en: string }> = {
  UNAUTHORIZED: { status: 401, ar: "يرجى تسجيل الدخول أولًا.", en: "Please sign in first." },
  NOT_FOUND: { status: 404, ar: "غير موجود.", en: "Not found." },
  VALIDATION_FAILED: { status: 400, ar: "بيانات غير صحيحة.", en: "Invalid input." },
  OTP_INVALID: { status: 400, ar: "رمز التحقق غير صحيح.", en: "The code is incorrect." },
  SLOT_TAKEN: { status: 409, ar: "تم حجز هذا الموعد للتو. اختر موعدًا آخر.", en: "Someone just booked this time. Please pick another slot." },
  SLOT_UNAVAILABLE: { status: 409, ar: "هذا الموعد لم يعد متاحًا.", en: "This slot is no longer available." },
  BOOKING_LIMIT: { status: 409, ar: "وصلت إلى الحد الأقصى للحجوزات القادمة.", en: "You have reached the upcoming bookings limit." },
  CANCEL_WINDOW_PASSED: { status: 409, ar: "انتهت مهلة التعديل أو الإلغاء.", en: "The cancel window has passed." },
  FORBIDDEN: { status: 403, ar: "غير مسموح.", en: "Not allowed." },
  FEATURE_DISABLED: { status: 403, ar: "هذه الخدمة غير متاحة عبر الإنترنت.", en: "This feature is not available." },
  INVALID_TRANSITION: { status: 409, ar: "لا يمكن تنفيذ هذا الإجراء.", en: "This action is not allowed." },
};

function problem(code: keyof typeof PROBLEM_TEXT, lang: Lang, feature?: string): Response {
  const p = PROBLEM_TEXT[code];
  return Response.json(
    {
      type: `https://moonlight.example/errors/${code.toLowerCase().replaceAll("_", "-")}`,
      title: p.en,
      status: p.status,
      code,
      detail: p[lang],
      traceId: "00-mock",
      ...(feature ? { feature } : {}),
    },
    { status: p.status, headers: { "content-type": "application/problem+json" } },
  );
}

/**
 * Demo feature switches: the clinic.config.json defaults, overridden by the
 * `MOCK_FEATURES` env var (a JSON object such as `{"website":false}`).
 */
export function mockFeatures(): Features {
  const features = { ...clinicConfig.features };
  try {
    const override = JSON.parse(process.env.MOCK_FEATURES || "{}") as Record<string, unknown>;
    for (const key of FEATURE_KEYS) {
      if (typeof override[key] === "boolean") features[key] = override[key];
    }
  } catch {
    // Ignore malformed overrides.
  }
  return features;
}

function localized<T extends { ar: string; en: string }>(value: T, lang: Lang) {
  return value[lang];
}

function specialtyDto(id: string, lang: Lang) {
  const sp = specialties.find((x) => x.id === id)!;
  return { id: sp.id, name: localized(sp.name, lang) };
}

function clinicSummary(lang: Lang) {
  return {
    id: clinic.id,
    name: localized(clinic.name, lang),
    city: localized(clinic.city, lang),
    address: localized(clinic.address, lang),
  };
}

function doctorSummary(d: MockDoctor, lang: Lang) {
  return {
    id: d.id,
    slug: d.slug,
    name: localized(d.name, lang),
    photoUrl: null,
    specialty: specialtyDto(d.specialtyId, lang),
    clinic: clinicSummary(lang),
    yearsExperience: d.yearsExperience,
    consultationFeeEgp: d.consultationFeeEgp,
  };
}

function doctorProfile(d: MockDoctor, lang: Lang) {
  return {
    ...doctorSummary(d, lang),
    bio: localized(d.bio, lang),
    clinic: {
      ...clinicSummary(lang),
      address: localized(clinic.address, lang),
      phone: clinic.phone,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      timezone: clinic.timezone,
    },
    services: d.services.map((x) => ({
      id: x.id,
      name: localized(x.name, lang),
      durationMinutes: x.durationMinutes,
      priceEgp: x.priceEgp,
    })),
  };
}

function appointmentDto(a: MockAppointment, lang: Lang) {
  const slot = state().slots.find((x) => x.id === a.slotId)!;
  const doctor = doctors.find((x) => x.id === slot.doctorId)!;
  const service = doctor.services.find((x) => x.id === a.serviceId);
  return {
    id: a.id,
    status: a.status,
    slotId: slot.id,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    startsAtLocal: toLocalIsoWithOffset(slot.startsAt, MOCK_TIMEZONE),
    timezone: MOCK_TIMEZONE,
    doctor: { id: doctor.id, slug: doctor.slug, name: localized(doctor.name, lang), photoUrl: null },
    clinic: {
      id: clinic.id,
      name: localized(clinic.name, lang),
      address: localized(clinic.address, lang),
      phone: clinic.phone,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
    },
    service: service
      ? {
          id: service.id,
          name: localized(service.name, lang),
          durationMinutes: service.durationMinutes,
          priceEgp: service.priceEgp,
        }
      : null,
    patientNote: a.patientNote ?? null,
    cancelledBy: a.cancelledBy ?? null,
    cancelReason: a.cancelReason ?? null,
  };
}

function findDoctor(idOrSlug: string) {
  return doctors.find((d) => d.id === idOrSlug || d.slug === idOrSlug);
}

function userDto() {
  const { fullName, preferredLanguage } = state().profile;
  return { ...patient, fullName, preferredLanguage };
}

function tokenResponse(isNewUser: boolean) {
  return {
    accessToken: `mock-access-${Date.now()}`,
    refreshToken: `mock-refresh-${Date.now()}`,
    expiresIn: 900,
    isNewUser,
    user: userDto(),
  };
}

function paged<T>(all: T[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
  return {
    items: all.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalCount: all.length,
  };
}

function isAuthed(headers: Headers) {
  return (headers.get("authorization") ?? "").startsWith("Bearer mock-access");
}

const nameOnly = (s: string) => s.toLowerCase();

export async function handleMockRequest(
  path: string,
  init: RequestInit = {},
  now: Date = new Date(),
): Promise<Response> {
  ensureReady(now);
  const url = new URL(path, "http://mock.local");
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  const lang: Lang = (headers.get("accept-language") ?? "ar").startsWith("en") ? "en" : "ar";
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const body = async () => {
    try {
      const raw =
        typeof init.body === "string"
          ? init.body
          : init.body
            ? new TextDecoder().decode(init.body as ArrayBuffer)
            : "";
      return (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    } catch {
      return {};
    }
  };
  const s = state();
  const [root, second, third] = segments;

  const features = mockFeatures();

  if (method === "GET" && root === "features" && !second) {
    return Response.json({ features, source: "defaults", updatedAt: new Date(0).toISOString() });
  }

  // Doctor search/profile/slots need a sign-in when guest browsing is off.
  if (root === "doctors" && !features.guestBrowsing && !isAuthed(headers)) {
    return problem("UNAUTHORIZED", lang);
  }

  // Public catalog
  if (method === "GET" && root === "specialties") {
    return Response.json(specialties.map((x) => specialtyDto(x.id, lang)));
  }
  if (method === "GET" && root === "cities") {
    return Response.json([localized(clinic.city, lang)]);
  }
  if (method === "GET" && root === "doctors" && !second) {
    const q = nameOnly(url.searchParams.get("q") ?? "");
    const specialtyId = url.searchParams.get("specialtyId");
    const city = nameOnly(url.searchParams.get("city") ?? "");
    const matches = doctors
      .filter((d) => !specialtyId || d.specialtyId === specialtyId)
      .filter(() => !city || [clinic.city.ar, clinic.city.en].map(nameOnly).includes(city))
      .filter((d) => !q || [d.name.ar, d.name.en].some((n) => nameOnly(n).includes(q)))
      .map((d) => doctorSummary(d, lang));
    return Response.json(paged(matches, url));
  }
  if (method === "GET" && root === "doctors" && second && !third) {
    const d = findDoctor(second);
    return d ? Response.json(doctorProfile(d, lang)) : problem("NOT_FOUND", lang);
  }
  if (method === "GET" && root === "doctors" && second && third === "slots") {
    const d = findDoctor(second);
    if (!d) return problem("NOT_FOUND", lang);
    const from = url.searchParams.get("from") ?? todayInZone(MOCK_TIMEZONE, now);
    const to = url.searchParams.get("to") ?? addDays(from, 6);
    const earliest = now.getTime() + MIN_LEAD_MINUTES * 60_000;
    const byDay = new Map<string, { id: string; startsAt: string; endsAt: string; local: string }[]>();
    for (const slot of s.slots
      .filter((x) => x.doctorId === d.id && x.status === "Open" && x.startsAt.getTime() >= earliest)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
      const local = toLocalIso(slot.startsAt, MOCK_TIMEZONE);
      const date = local.slice(0, 10);
      if (date < from || date > to) continue;
      const list = byDay.get(date) ?? [];
      list.push({
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        local: local.slice(11, 16),
      });
      byDay.set(date, list);
    }
    return Response.json({
      doctorId: d.id,
      timezone: MOCK_TIMEZONE,
      days: [...byDay.entries()].map(([date, slots]) => ({ date, slots })),
    });
  }

  // Auth
  if (root === "auth" && method === "POST") {
    if (second === "otp" && third === "request") return new Response(null, { status: 204 });
    if (second === "otp" && third === "verify") {
      const { code } = await body();
      return code === MOCK_OTP ? Response.json(tokenResponse(false)) : problem("OTP_INVALID", lang);
    }
    if (second === "refresh") {
      const { refreshToken } = await body();
      return String(refreshToken ?? "").startsWith("mock-refresh")
        ? Response.json(tokenResponse(false))
        : problem("UNAUTHORIZED", lang);
    }
    if (second === "logout") return new Response(null, { status: 204 });
  }

  // Authenticated patient endpoints
  if (root === "me" || root === "appointments") {
    if (!isAuthed(headers)) return problem("UNAUTHORIZED", lang);

    if (root === "me") {
      if (method === "GET") return Response.json(userDto());
      if (method === "PUT") {
        const patch = await body();
        if (typeof patch.fullName === "string") s.profile.fullName = patch.fullName;
        if (patch.preferredLanguage === "ar" || patch.preferredLanguage === "en") {
          s.profile.preferredLanguage = patch.preferredLanguage;
        }
        return Response.json(userDto());
      }
    }

    const mine = () =>
      s.appointments
        .map((a) => ({ a, slot: s.slots.find((x) => x.id === a.slotId)! }))
        .sort((x, y) => x.slot.startsAt.getTime() - y.slot.startsAt.getTime());
    const isUpcoming = (x: { a: MockAppointment; slot: MockSlot }) =>
      x.a.status === "Confirmed" && x.slot.endsAt.getTime() > now.getTime();

    if (root === "appointments" && !second) {
      if (method === "GET") {
        const scope = url.searchParams.get("scope") ?? "upcoming";
        const rows = mine().filter((x) => (scope === "past" ? !isUpcoming(x) : isUpcoming(x)));
        if (scope === "past") rows.reverse();
        return Response.json(paged(rows.map((x) => appointmentDto(x.a, lang)), url));
      }
      if (method === "POST") {
        const input = await body();
        const slot = s.slots.find((x) => x.id === input.slotId);
        if (!slot || slot.status === "Blocked") return problem("NOT_FOUND", lang);
        if (slot.status !== "Open") return problem("SLOT_TAKEN", lang);
        if (slot.startsAt.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) {
          return problem("SLOT_UNAVAILABLE", lang);
        }
        const upcoming = mine().filter(isUpcoming);
        const day = toLocalIso(slot.startsAt, MOCK_TIMEZONE).slice(0, 10);
        const sameDay = upcoming.some(
          (x) =>
            x.slot.doctorId === slot.doctorId &&
            toLocalIso(x.slot.startsAt, MOCK_TIMEZONE).slice(0, 10) === day,
        );
        if (upcoming.length >= MAX_UPCOMING || sameDay) return problem("BOOKING_LIMIT", lang);
        slot.status = "Reserved";
        const appointment: MockAppointment = {
          id: newId("f"),
          slotId: slot.id,
          status: "Confirmed",
          serviceId: typeof input.serviceId === "string" ? input.serviceId : undefined,
          patientNote: typeof input.patientNote === "string" ? input.patientNote : undefined,
        };
        s.appointments.push(appointment);
        return Response.json(appointmentDto(appointment, lang), { status: 201 });
      }
    }

    if (root === "appointments" && second) {
      const appt = s.appointments.find((x) => x.id === second);
      if (!appt) return problem("NOT_FOUND", lang);
      const slot = s.slots.find((x) => x.id === appt.slotId)!;
      if (method === "GET" && !third) return Response.json(appointmentDto(appt, lang));

      if (method === "POST" && (third === "cancel" || third === "reschedule")) {
        if (!features.patientSelfService) {
          return problem("FEATURE_DISABLED", lang, "patientSelfService");
        }
        if (appt.status !== "Confirmed") return problem("INVALID_TRANSITION", lang);
        if (slot.startsAt.getTime() - now.getTime() < CANCEL_WINDOW_HOURS * 3_600_000) {
          return problem("CANCEL_WINDOW_PASSED", lang);
        }
        const input = await body();
        if (third === "cancel") {
          appt.status = "Cancelled";
          appt.cancelledBy = "Patient";
          if (typeof input.reason === "string") appt.cancelReason = input.reason;
          slot.status = "Open";
          return Response.json(appointmentDto(appt, lang));
        }
        const target = s.slots.find((x) => x.id === input.slotId);
        if (!target || target.doctorId !== slot.doctorId) return problem("NOT_FOUND", lang);
        if (target.status !== "Open") return problem("SLOT_TAKEN", lang);
        if (target.startsAt.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) {
          return problem("SLOT_UNAVAILABLE", lang);
        }
        target.status = "Reserved";
        slot.status = "Open";
        appt.slotId = target.id;
        return Response.json(appointmentDto(appt, lang));
      }
    }
  }

  return problem("NOT_FOUND", lang);
}
