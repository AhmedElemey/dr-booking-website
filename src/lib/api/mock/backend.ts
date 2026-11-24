import {
  addDays,
  toLocalIso,
  toLocalIsoWithOffset,
  todayInZone,
  zonedTimeToUtc,
} from "../../datetime";
import {
  clinicConfig,
  FEATURE_KEYS,
  PHASE2_FEATURE_KEYS,
  type Features,
} from "../../clinic-config";
import {
  clinic,
  coupons,
  DEMO_CLOSURE_DAYS,
  DEMO_CLOSURE_NAME,
  doctors,
  holidays,
  insuranceProviders,
  MOCK_OTP,
  MOCK_TIMEZONE,
  patient,
  records,
  reviews as seedReviews,
  specialties,
} from "./fixtures";
import type { MockCoupon, MockDoctor } from "./fixtures";

// In-memory stand-in for the Dr booking API (MOCK_API=1). It follows the spec's
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
type PaymentStatus = "Unpaid" | "Pending" | "Paid" | "Refunded";
type MockAppointment = {
  id: string;
  slotId: string;
  status: "Confirmed" | "Cancelled" | "Completed" | "NoShow";
  serviceId?: string;
  patientNote?: string;
  cancelledBy?: "Patient";
  cancelReason?: string;
  familyMemberId?: string;
  mode: "InPerson" | "Video";
  priceEgp: number | null;
  discountEgp: number;
  couponCode?: string;
  paymentStatus: PaymentStatus;
  insurance?: {
    providerId: string;
    memberNumber: string;
    status: "Pending" | "Approved" | "Rejected";
    note?: string;
  };
  review?: { rating: number; comment?: string; createdAt: string };
};
type MockMember = {
  id: string;
  fullName: string;
  relation: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  createdAt: string;
};
type MockWaiting = {
  id: string;
  doctorId: string;
  date: string;
  familyMemberId?: string;
  status: "Waiting" | "Notified" | "Booked" | "Cancelled" | "Expired";
  notifiedAt?: string;
  createdAt: string;
};
type MockPayment = {
  id: string;
  appointmentId: string;
  amountEgp: number;
  status: "Pending" | "Paid" | "Failed" | "Refunded" | "Cancelled";
  polls: number;
};

type MockState = {
  slots: MockSlot[];
  appointments: MockAppointment[];
  family: MockMember[];
  waiting: MockWaiting[];
  payments: MockPayment[];
  generatedDays: Set<string>;
  seeded: boolean;
  profile: {
    fullName: string | null;
    preferredLanguage: Lang;
    whatsAppOptIn: boolean;
    marketingOptIn: boolean;
  };
  nextId: number;
};

const MIN_LEAD_MINUTES = 60;
const CANCEL_WINDOW_HOURS = 2;
const MAX_UPCOMING = 3;
const DAYS_AHEAD = 10;
const SLOT_MINUTES = 30;

const globalStore = globalThis as unknown as { __drbookingMock?: MockState };

function state(): MockState {
  globalStore.__drbookingMock ??= {
    slots: [],
    appointments: [],
    family: [],
    waiting: [],
    payments: [],
    generatedDays: new Set(),
    seeded: false,
    profile: {
      fullName: patient.fullName,
      preferredLanguage: patient.preferredLanguage,
      whatsAppOptIn: true,
      marketingOptIn: true,
    },
    nextId: 1,
  };
  return globalStore.__drbookingMock;
}

/** Test hook: forget all demo state. */
export function resetMockState() {
  globalStore.__drbookingMock = undefined;
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

function priceOf(doctor: MockDoctor, serviceId?: string): number | null {
  const service = doctor.services.find((x) => x.id === serviceId);
  return service?.priceEgp ?? doctor.consultationFeeEgp ?? null;
}

function newAppointment(
  slot: MockSlot,
  doctor: MockDoctor,
  extra: Partial<MockAppointment> & Pick<MockAppointment, "status">,
): MockAppointment {
  return {
    id: newId("f"),
    slotId: slot.id,
    mode: "InPerson",
    priceEgp: priceOf(doctor, extra.serviceId),
    discountEgp: 0,
    paymentStatus: "Unpaid",
    ...extra,
  };
}

function nextWeekday(today: string, weekday: number): string {
  let date = addDays(today, 1);
  while (weekdayOf(date) !== weekday) date = addDays(date, 1);
  return date;
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

  // Family members (family accounts feature).
  const child = {
    id: newId("a"),
    fullName: "ياسين أحمد مصطفى",
    relation: "Child",
    dateOfBirth: "2019-05-14",
    gender: "Male",
    createdAt: now.toISOString(),
  };
  const spouse = {
    id: newId("a"),
    fullName: "منى إبراهيم",
    relation: "Spouse",
    dateOfBirth: "1991-09-02",
    gender: "Female",
    createdAt: now.toISOString(),
  };
  s.family.push(child, spouse);

  const [sara, omar, mona] = doctors;
  const upcoming1 = reserveAt(sara, 2, "11:00");
  const upcoming2 = reserveAt(omar, 4, "17:00");
  const childVisit = reserveAt(mona, 6, "10:30");
  const past1 = reserveAt(sara, -20, "09:00");
  const past2 = reserveAt(mona, -12, "10:30");
  s.appointments.push(
    newAppointment(upcoming1, sara, {
      status: "Confirmed",
      serviceId: sara.services[1].id,
      discountEgp: 100,
      couponCode: "SMILE100",
      paymentStatus: "Paid",
    }),
    newAppointment(upcoming2, omar, {
      status: "Confirmed",
      serviceId: omar.services[0].id,
      patientNote: "Wisdom tooth discomfort",
      mode: "Video",
      insurance: { providerId: insuranceProviders[1].id, memberNumber: "NM-5530-1182", status: "Approved" },
    }),
    newAppointment(childVisit, mona, {
      status: "Confirmed",
      serviceId: mona.services[0].id,
      familyMemberId: child.id,
      insurance: { providerId: insuranceProviders[0].id, memberNumber: "MC-2048-7731", status: "Pending" },
    }),
    newAppointment(past1, sara, {
      status: "Completed",
      serviceId: sara.services[0].id,
      paymentStatus: "Paid",
    }),
    newAppointment(past2, mona, {
      status: "Completed",
      serviceId: mona.services[0].id,
      familyMemberId: child.id,
      paymentStatus: "Paid",
      review: {
        rating: 5,
        comment: "دكتورة رائعة مع الأطفال، شكرًا لها.",
        createdAt: new Date(now.getTime() - 10 * 86_400_000).toISOString(),
      },
    }),
  );

  // Waiting list: a closed Friday with Dr. Omar, and a notified entry with Dr. Mona.
  s.waiting.push(
    {
      id: newId("b"),
      doctorId: omar.id,
      date: nextWeekday(today, 5),
      status: "Waiting",
      createdAt: now.toISOString(),
    },
    {
      id: newId("b"),
      doctorId: mona.id,
      date: addDays(today, 3),
      familyMemberId: child.id,
      status: "Notified",
      notifiedAt: new Date(now.getTime() - 2 * 3_600_000).toISOString(),
      createdAt: new Date(now.getTime() - 86_400_000).toISOString(),
    },
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
  CLINIC_CLOSED: { status: 409, ar: "المركز مغلق في هذا اليوم.", en: "The clinic is closed on this day." },
  COUPON_INVALID: { status: 422, ar: "كود الخصم غير صالح.", en: "This coupon code is not valid." },
  ALREADY_REVIEWED: { status: 409, ar: "سبق أن قيّمت هذه الزيارة.", en: "You have already reviewed this visit." },
  NOT_REVIEWABLE: { status: 409, ar: "لا يمكن تقييم هذه الزيارة.", en: "This visit cannot be reviewed." },
  PAYMENT_NOT_ALLOWED: { status: 409, ar: "لا يمكن الدفع لهذا الموعد.", en: "This appointment cannot be paid online." },
  VIDEO_NOT_OPEN: { status: 409, ar: "غرفة الفيديو غير مفتوحة بعد.", en: "The video room is not open yet." },
  ALREADY_WAITING: { status: 409, ar: "أنت بالفعل في قائمة الانتظار لهذا اليوم.", en: "You are already on the waiting list for this day." },
  PROVIDER_ERROR: { status: 502, ar: "تعذر الاتصال بمزود الخدمة.", en: "The provider could not be reached." },
};

function problem(
  code: keyof typeof PROBLEM_TEXT,
  lang: Lang,
  opts: { feature?: string; reason?: string; status?: number } = {},
): Response {
  const p = PROBLEM_TEXT[code];
  const status = opts.status ?? p.status;
  return Response.json(
    {
      type: `https://drbooking.example/errors/${code.toLowerCase().replaceAll("_", "-")}`,
      title: p.en,
      status,
      code,
      detail: p[lang],
      traceId: "00-mock",
      ...(opts.feature ? { feature: opts.feature } : {}),
      ...(opts.reason ? { reason: opts.reason } : {}),
    },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

/**
 * Demo feature switches: the clinic.config.json defaults with all 13 phase-2
 * features switched on, overridden by the `MOCK_FEATURES` env var (a JSON
 * object such as `{"website":false,"reviews":false}`).
 */
export function mockFeatures(): Features {
  const features = { ...clinicConfig.features };
  for (const key of PHASE2_FEATURE_KEYS) features[key] = true;
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

function firstName(full: string | null): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

type PublishedReview = {
  doctorId: string;
  rating: number;
  comment: string | null;
  patientFirstName: string;
  createdAt: string;
  reply: string | null;
};

/** Seeded reviews plus the ones the demo patient wrote, newest first. */
function publishedReviews(doctorId: string, lang: Lang, now: Date): PublishedReview[] {
  const seeded = seedReviews
    .filter((r) => r.doctorId === doctorId)
    .map((r) => ({
      doctorId,
      rating: r.rating,
      comment: r.comment[lang],
      patientFirstName: r.name[lang],
      createdAt: new Date(now.getTime() - r.daysAgo * 86_400_000).toISOString(),
      reply: r.reply ? r.reply[lang] : null,
    }));
  const own = state()
    .appointments.filter((a) => a.review && slotDoctorId(a) === doctorId)
    .map((a) => ({
      doctorId,
      rating: a.review!.rating,
      comment: a.review!.comment ?? null,
      patientFirstName: firstName(state().profile.fullName),
      createdAt: a.review!.createdAt,
      reply: null,
    }));
  return [...seeded, ...own].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}

function slotDoctorId(a: MockAppointment): string {
  return state().slots.find((x) => x.id === a.slotId)!.doctorId;
}

function ratingOf(doctorId: string, lang: Lang, now: Date) {
  const list = publishedReviews(doctorId, lang, now);
  if (list.length === 0) return null;
  const sum = list.reduce((n, r) => n + r.rating, 0);
  return { average: Math.round((sum / list.length) * 10) / 10, count: list.length };
}

function insuranceDto(id: string, lang: Lang) {
  const p = insuranceProviders.find((x) => x.id === id)!;
  return { id: p.id, name: localized(p.name, lang) };
}

function doctorSummary(d: MockDoctor, lang: Lang, features: Features, now: Date) {
  return {
    id: d.id,
    slug: d.slug,
    name: localized(d.name, lang),
    photoUrl: null,
    specialty: specialtyDto(d.specialtyId, lang),
    clinic: clinicSummary(lang),
    yearsExperience: d.yearsExperience,
    consultationFeeEgp: d.consultationFeeEgp,
    rating: features.reviews ? ratingOf(d.id, lang, now) : null,
    offersVideo: features.videoConsultation && d.offersVideo,
    insuranceProviders: features.insurance ? d.insuranceIds.map((id) => insuranceDto(id, lang)) : [],
  };
}

function doctorProfile(d: MockDoctor, lang: Lang, features: Features, now: Date) {
  return {
    ...doctorSummary(d, lang, features, now),
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

function memberRef(id: string | undefined) {
  const m = id ? state().family.find((x) => x.id === id) : undefined;
  return m ? { id: m.id, fullName: m.fullName, relation: m.relation } : null;
}

function appointmentDto(a: MockAppointment, lang: Lang, features: Features) {
  const slot = state().slots.find((x) => x.id === a.slotId)!;
  const doctor = doctors.find((x) => x.id === slot.doctorId)!;
  const service = doctor.services.find((x) => x.id === a.serviceId);
  const total = a.priceEgp == null ? null : Math.max(0, a.priceEgp - a.discountEgp);
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
    mode: a.mode,
    priceEgp: a.priceEgp,
    discountEgp: a.discountEgp,
    totalEgp: total,
    paymentStatus: a.paymentStatus,
    familyMember: features.familyAccounts ? memberRef(a.familyMemberId) : null,
    insurance:
      features.insurance && a.insurance
        ? {
            provider: insuranceDto(a.insurance.providerId, lang),
            memberNumber: a.insurance.memberNumber,
            status: a.insurance.status,
            note: a.insurance.note ?? null,
          }
        : null,
    canReview: features.reviews && a.status === "Completed" && !a.review,
    review: a.review ? { rating: a.review.rating, comment: a.review.comment ?? null } : null,
  };
}

function findDoctor(idOrSlug: string) {
  return doctors.find((d) => d.id === idOrSlug || d.slug === idOrSlug);
}

function userDto() {
  const { fullName, preferredLanguage, whatsAppOptIn, marketingOptIn } = state().profile;
  return { ...patient, fullName, preferredLanguage, whatsAppOptIn, marketingOptIn };
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

function paged<T>(all: T[], url: URL, defaultSize = 20) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || defaultSize));
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

/** Clinic closures: fixed Egyptian public holidays plus a demo closure a few days out. */
function closedDatesOf(today: string, lang: Lang) {
  return [
    ...holidays.map((h) => ({ date: h.date, name: localized(h.name, lang) })),
    { date: addDays(today, DEMO_CLOSURE_DAYS), name: localized(DEMO_CLOSURE_NAME, lang) },
  ];
}

function localDate(instant: Date) {
  return toLocalIso(instant, MOCK_TIMEZONE).slice(0, 10);
}

/** Whole discount for a price, never more than the price itself. */
function discountFor(coupon: MockCoupon, price: number): number {
  const raw =
    coupon.discountType === "Percent" ? Math.floor((price * coupon.value) / 100) : coupon.value;
  const capped = coupon.maxDiscountEgp != null ? Math.min(raw, coupon.maxDiscountEgp) : raw;
  return Math.min(capped, price);
}

type CouponReason =
  | "NotFound"
  | "Expired"
  | "NotStarted"
  | "Exhausted"
  | "PerPatientLimit"
  | "NotApplicable"
  | "NoPrice";

function checkCoupon(
  code: string,
  doctor: MockDoctor,
  serviceId: string | undefined,
  now: Date,
): { coupon?: MockCoupon; discountEgp: number; totalEgp: number; reason?: CouponReason } {
  const price = priceOf(doctor, serviceId);
  const coupon = coupons.find((c) => c.code === code.trim().toUpperCase());
  const fail = (reason: CouponReason) => ({ discountEgp: 0, totalEgp: price ?? 0, reason });
  if (!coupon) return fail("NotFound");
  const today = todayInZone(MOCK_TIMEZONE, now);
  if (addDays(today, coupon.validFromDays) > today) return fail("NotStarted");
  if (addDays(today, coupon.validToDays) < today) return fail("Expired");
  if (coupon.maxRedemptions != null && coupon.redemptions >= coupon.maxRedemptions) {
    return fail("Exhausted");
  }
  const mine = state().appointments.filter(
    (a) => a.couponCode === coupon.code && a.status !== "Cancelled",
  ).length;
  if (mine >= coupon.perPatientLimit) return fail("PerPatientLimit");
  if (
    (coupon.doctorId && coupon.doctorId !== doctor.id) ||
    (coupon.serviceId && coupon.serviceId !== serviceId)
  ) {
    return fail("NotApplicable");
  }
  if (price == null || price <= 0) return fail("NoPrice");
  const discountEgp = discountFor(coupon, price);
  return { coupon, discountEgp, totalEgp: price - discountEgp };
}

/** First upcoming Waiting entries of a doctor+date become Notified when a slot opens there. */
function notifyWaiting(doctorId: string, date: string, now: Date) {
  for (const entry of state().waiting) {
    if (entry.doctorId === doctorId && entry.date === date && entry.status === "Waiting") {
      entry.status = "Notified";
      entry.notifiedAt = now.toISOString();
    }
  }
}

const VIDEO_OPENS_MINUTES = 15;
const VIDEO_CLOSES_MINUTES = 30;
const RELATIONS = ["Child", "Spouse", "Parent", "Sibling", "Other"];
const MAX_FAMILY = 10;

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
  const off = (key: keyof Features) =>
    problem("FEATURE_DISABLED", lang, { feature: key as string });
  const today = todayInZone(MOCK_TIMEZONE, now);

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
  if (method === "GET" && root === "insurance-providers") {
    if (!features.insurance) return off("insurance");
    return Response.json(insuranceProviders.map((p) => insuranceDto(p.id, lang)));
  }
  if (method === "GET" && root === "promotions") {
    if (!features.promotions) return off("promotions");
    return Response.json(
      coupons
        .filter(
          (c) =>
            c.isPublic &&
            addDays(today, c.validFromDays) <= today &&
            addDays(today, c.validToDays) >= today,
        )
        .map((c) => ({
          code: c.code,
          title: localized(c.title, lang),
          description: localized(c.description, lang),
          discountType: c.discountType,
          value: c.value,
          validTo: addDays(today, c.validToDays),
          doctorId: c.doctorId ?? null,
          serviceId: c.serviceId ?? null,
        })),
    );
  }
  if (method === "GET" && root === "doctors" && !second) {
    const q = nameOnly(url.searchParams.get("q") ?? "");
    const specialtyId = url.searchParams.get("specialtyId");
    const insuranceProviderId = features.insurance ? url.searchParams.get("insuranceProviderId") : null;
    const city = nameOnly(url.searchParams.get("city") ?? "");
    const matches = doctors
      .filter((d) => !specialtyId || d.specialtyId === specialtyId)
      .filter((d) => !insuranceProviderId || d.insuranceIds.includes(insuranceProviderId))
      .filter(() => !city || [clinic.city.ar, clinic.city.en].map(nameOnly).includes(city))
      .filter((d) => !q || [d.name.ar, d.name.en].some((n) => nameOnly(n).includes(q)))
      .map((d) => doctorSummary(d, lang, features, now));
    return Response.json(paged(matches, url));
  }
  if (method === "GET" && root === "doctors" && second && !third) {
    const d = findDoctor(second);
    return d ? Response.json(doctorProfile(d, lang, features, now)) : problem("NOT_FOUND", lang);
  }
  if (method === "GET" && root === "doctors" && second && third === "reviews") {
    if (!features.reviews) return off("reviews");
    const d = findDoctor(second);
    if (!d) return problem("NOT_FOUND", lang);
    const list = publishedReviews(d.id, lang, now).map(
      ({ rating, comment, patientFirstName, createdAt, reply }) => ({
        rating,
        comment,
        patientFirstName,
        createdAt,
        reply,
      }),
    );
    return Response.json(paged(list, url, 5));
  }
  if (method === "GET" && root === "doctors" && second && third === "slots") {
    const d = findDoctor(second);
    if (!d) return problem("NOT_FOUND", lang);
    const from = url.searchParams.get("from") ?? todayInZone(MOCK_TIMEZONE, now);
    const to = url.searchParams.get("to") ?? addDays(from, 6);
    const earliest = now.getTime() + MIN_LEAD_MINUTES * 60_000;
    const closed = features.holidayCalendar ? closedDatesOf(today, lang) : [];
    const closedKeys = new Set(closed.map((c) => c.date));
    const byDay = new Map<string, { id: string; startsAt: string; endsAt: string; local: string }[]>();
    for (const slot of s.slots
      .filter((x) => x.doctorId === d.id && x.status === "Open" && x.startsAt.getTime() >= earliest)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
      const local = toLocalIso(slot.startsAt, MOCK_TIMEZONE);
      const date = local.slice(0, 10);
      if (date < from || date > to || closedKeys.has(date)) continue;
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
      ...(features.holidayCalendar
        ? { closedDates: closed.filter((c) => c.date >= from && c.date <= to) }
        : {}),
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
  const patientRoots = ["me", "appointments", "waiting-list", "payments", "coupons"];
  if (patientRoots.includes(root ?? "")) {
    if (!isAuthed(headers)) return problem("UNAUTHORIZED", lang);

    if (root === "me" && !second) {
      if (method === "GET") return Response.json(userDto());
      if (method === "PUT") {
        const patch = await body();
        if (typeof patch.fullName === "string") s.profile.fullName = patch.fullName;
        if (patch.preferredLanguage === "ar" || patch.preferredLanguage === "en") {
          s.profile.preferredLanguage = patch.preferredLanguage;
        }
        if (typeof patch.whatsAppOptIn === "boolean") s.profile.whatsAppOptIn = patch.whatsAppOptIn;
        if (typeof patch.marketingOptIn === "boolean") s.profile.marketingOptIn = patch.marketingOptIn;
        return Response.json(userDto());
      }
    }

    // Family accounts
    if (root === "me" && second === "family") {
      if (!features.familyAccounts) return off("familyAccounts");
      const toDto = (m: MockMember) => ({ ...m });
      const input = async () => {
        const raw = await body();
        const fullName = typeof raw.fullName === "string" ? raw.fullName.trim() : "";
        if (!fullName || !RELATIONS.includes(String(raw.relation))) return null;
        return {
          fullName,
          relation: String(raw.relation),
          dateOfBirth: typeof raw.dateOfBirth === "string" && raw.dateOfBirth ? raw.dateOfBirth : null,
          gender: raw.gender === "Male" || raw.gender === "Female" ? raw.gender : null,
        };
      };
      if (!third && method === "GET") return Response.json(s.family.map(toDto));
      if (!third && method === "POST") {
        const data = await input();
        if (!data || s.family.length >= MAX_FAMILY) return problem("VALIDATION_FAILED", lang, { status: 422 });
        const member = { id: newId("a"), ...data, createdAt: now.toISOString() };
        s.family.push(member);
        return Response.json(toDto(member), { status: 201 });
      }
      const member = s.family.find((m) => m.id === third);
      if (third && !member) return problem("NOT_FOUND", lang);
      if (member && method === "PUT") {
        const data = await input();
        if (!data) return problem("VALIDATION_FAILED", lang, { status: 422 });
        Object.assign(member, data);
        return Response.json(toDto(member));
      }
      if (member && method === "DELETE") {
        s.family = s.family.filter((m) => m !== member);
        return new Response(null, { status: 204 });
      }
    }

    // Patient records
    if (root === "me" && second === "records" && method === "GET") {
      if (!features.patientRecords) return off("patientRecords");
      const memberId = url.searchParams.get("familyMemberId");
      if (memberId) {
        const member = s.family.find((m) => m.id === memberId);
        if (!member) return problem("NOT_FOUND", lang);
        return Response.json({
          medicalInfo: {
            bloodType: "A+",
            allergies: localized({ ar: "لا يوجد", en: "None" }, lang),
            chronicConditions: null,
            medications: null,
            updatedAt: new Date(now.getTime() - 40 * 86_400_000).toISOString(),
          },
          entries: [
            {
              id: "71000000-0000-4000-8000-000000000010",
              kind: "Note",
              title: localized({ ar: "كشف أطفال: حالة الأسنان اللبنية جيدة", en: "Child check-up: baby teeth in good condition" }, lang),
              body: localized({ ar: "ننصح بالفلورايد الوقائي كل ستة أشهر.", en: "Preventive fluoride every six months is advised." }, lang),
              doctor: { id: doctors[2].id, name: localized(doctors[2].name, lang) },
              createdAt: new Date(now.getTime() - 12 * 86_400_000).toISOString(),
            },
          ],
        });
      }
      return Response.json({
        medicalInfo: {
          bloodType: records.medicalInfo.bloodType,
          allergies: localized(records.medicalInfo.allergies, lang),
          chronicConditions: localized(records.medicalInfo.chronicConditions, lang),
          medications: localized(records.medicalInfo.medications, lang),
          updatedAt: new Date(now.getTime() - 20 * 86_400_000).toISOString(),
        },
        entries: records.entries.map((e) => ({
          id: e.id,
          kind: e.kind,
          title: localized(e.title, lang),
          body: localized(e.body, lang),
          attachmentUrl: null,
          doctorName: localized(doctors[e.doctorIndex].name, lang),
          createdAt: new Date(now.getTime() - e.daysAgo * 86_400_000).toISOString(),
        })),
      });
    }

    // Waiting list
    if (root === "waiting-list") {
      if (!features.waitingList) return off("waitingList");
      const entryDto = (e: MockWaiting) => {
        const d = doctors.find((x) => x.id === e.doctorId)!;
        return {
          id: e.id,
          doctor: { id: d.id, slug: d.slug, name: localized(d.name, lang), photoUrl: null },
          date: e.date,
          status: e.status,
          notifiedAt: e.notifiedAt ?? null,
          familyMember: memberRef(e.familyMemberId),
        };
      };
      if (!second && method === "GET") {
        return Response.json(
          [...s.waiting].sort((a, b) => a.date.localeCompare(b.date)).map(entryDto),
        );
      }
      if (!second && method === "POST") {
        const input = await body();
        const doctor = findDoctor(String(input.doctorId ?? ""));
        const date = String(input.date ?? "");
        if (!doctor || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) {
          return problem("VALIDATION_FAILED", lang, { status: 422 });
        }
        const memberId = typeof input.familyMemberId === "string" ? input.familyMemberId : undefined;
        const active = s.waiting.some(
          (e) =>
            e.doctorId === doctor.id &&
            e.date === date &&
            e.familyMemberId === memberId &&
            (e.status === "Waiting" || e.status === "Notified"),
        );
        if (active) return problem("ALREADY_WAITING", lang);
        const entry: MockWaiting = {
          id: newId("b"),
          doctorId: doctor.id,
          date,
          familyMemberId: memberId,
          status: "Waiting",
          createdAt: now.toISOString(),
        };
        s.waiting.push(entry);
        return Response.json(entryDto(entry), { status: 201 });
      }
      if (second && method === "DELETE") {
        const entry = s.waiting.find((e) => e.id === second);
        if (!entry) return problem("NOT_FOUND", lang);
        entry.status = "Cancelled";
        return new Response(null, { status: 204 });
      }
    }

    // Promotions
    if (root === "coupons" && second === "validate" && method === "POST") {
      if (!features.promotions) return off("promotions");
      const input = await body();
      const doctor = findDoctor(String(input.doctorId ?? ""));
      if (!doctor || typeof input.code !== "string") return problem("VALIDATION_FAILED", lang, { status: 422 });
      const serviceId = typeof input.serviceId === "string" ? input.serviceId : undefined;
      const result = checkCoupon(input.code, doctor, serviceId, now);
      return Response.json({
        valid: !result.reason,
        discountEgp: result.discountEgp,
        totalEgp: result.totalEgp,
        ...(result.reason ? { reason: result.reason } : {}),
      });
    }

    // Online payments
    if (root === "payments" && second && method === "GET") {
      if (!features.onlinePayments) return off("onlinePayments");
      const payment = s.payments.find((p) => p.id === second);
      if (!payment) return problem("NOT_FOUND", lang);
      // The demo "provider" confirms the payment on the second look, like a webhook arriving.
      payment.polls++;
      if (payment.status === "Pending" && payment.polls >= 2) {
        payment.status = "Paid";
        const appt = s.appointments.find((a) => a.id === payment.appointmentId);
        if (appt) appt.paymentStatus = "Paid";
      }
      return Response.json({
        id: payment.id,
        appointmentId: payment.appointmentId,
        amountEgp: payment.amountEgp,
        status: payment.status,
      });
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
        return Response.json(paged(rows.map((x) => appointmentDto(x.a, lang, features)), url));
      }
      if (method === "POST") {
        const input = await body();
        const slot = s.slots.find((x) => x.id === input.slotId);
        if (!slot || slot.status === "Blocked") return problem("NOT_FOUND", lang);
        if (slot.status !== "Open") return problem("SLOT_TAKEN", lang);
        if (slot.startsAt.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) {
          return problem("SLOT_UNAVAILABLE", lang);
        }
        const doctor = doctors.find((x) => x.id === slot.doctorId)!;
        const day = localDate(slot.startsAt);
        if (features.holidayCalendar && closedDatesOf(today, lang).some((c) => c.date === day)) {
          return problem("CLINIC_CLOSED", lang);
        }

        // Feature-only fields are ignored while their feature is off.
        let familyMemberId: string | undefined;
        if (features.familyAccounts && typeof input.familyMemberId === "string") {
          if (!s.family.some((m) => m.id === input.familyMemberId)) {
            return problem("FORBIDDEN", lang);
          }
          familyMemberId = input.familyMemberId;
        }
        let mode: "InPerson" | "Video" = "InPerson";
        if (features.videoConsultation && input.mode === "Video") {
          if (!doctor.offersVideo) return problem("VALIDATION_FAILED", lang, { status: 422 });
          mode = "Video";
        }
        let insurance: MockAppointment["insurance"];
        const ins = input.insurance as { providerId?: unknown; memberNumber?: unknown } | undefined;
        if (features.insurance && ins && typeof ins === "object") {
          if (
            typeof ins.providerId !== "string" ||
            !doctor.insuranceIds.includes(ins.providerId) ||
            typeof ins.memberNumber !== "string" ||
            !ins.memberNumber.trim()
          ) {
            return problem("VALIDATION_FAILED", lang, { status: 422 });
          }
          insurance = {
            providerId: ins.providerId,
            memberNumber: ins.memberNumber.trim(),
            status: "Pending",
          };
        }

        // Per-person upcoming limit (the owner and each family member count separately).
        const upcoming = mine().filter(isUpcoming).filter((x) => x.a.familyMemberId === familyMemberId);
        const sameDay = upcoming.some(
          (x) => x.slot.doctorId === slot.doctorId && localDate(x.slot.startsAt) === day,
        );
        if (upcoming.length >= MAX_UPCOMING || sameDay) return problem("BOOKING_LIMIT", lang);

        const serviceId = typeof input.serviceId === "string" ? input.serviceId : undefined;
        let discountEgp = 0;
        let couponCode: string | undefined;
        if (features.promotions && typeof input.couponCode === "string" && input.couponCode.trim()) {
          const checked = checkCoupon(input.couponCode, doctor, serviceId, now);
          if (checked.reason || !checked.coupon) {
            return problem("COUPON_INVALID", lang, { reason: checked.reason });
          }
          discountEgp = checked.discountEgp;
          couponCode = checked.coupon.code;
        }

        slot.status = "Reserved";
        const appointment = newAppointment(slot, doctor, {
          status: "Confirmed",
          serviceId,
          patientNote: typeof input.patientNote === "string" ? input.patientNote : undefined,
          familyMemberId,
          mode,
          insurance,
          discountEgp,
          couponCode,
        });
        s.appointments.push(appointment);
        // A booking on a day someone was waiting for settles that waiting entry.
        for (const entry of s.waiting) {
          if (
            entry.doctorId === doctor.id &&
            entry.date === day &&
            entry.familyMemberId === familyMemberId &&
            (entry.status === "Waiting" || entry.status === "Notified")
          ) {
            entry.status = "Booked";
          }
        }
        return Response.json(appointmentDto(appointment, lang, features), { status: 201 });
      }
    }

    if (root === "appointments" && second) {
      const appt = s.appointments.find((x) => x.id === second);
      if (!appt) return problem("NOT_FOUND", lang);
      const slot = s.slots.find((x) => x.id === appt.slotId)!;
      if (method === "GET" && !third) return Response.json(appointmentDto(appt, lang, features));

      if (method === "POST" && (third === "cancel" || third === "reschedule")) {
        if (!features.patientSelfService) {
          return off("patientSelfService");
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
          if (appt.paymentStatus === "Paid") appt.paymentStatus = "Refunded";
          slot.status = "Open";
          notifyWaiting(slot.doctorId, localDate(slot.startsAt), now);
          return Response.json(appointmentDto(appt, lang, features));
        }
        const target = s.slots.find((x) => x.id === input.slotId);
        if (!target || target.doctorId !== slot.doctorId) return problem("NOT_FOUND", lang);
        if (target.status !== "Open") return problem("SLOT_TAKEN", lang);
        if (target.startsAt.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) {
          return problem("SLOT_UNAVAILABLE", lang);
        }
        if (features.holidayCalendar && closedDatesOf(today, lang).some((c) => c.date === localDate(target.startsAt))) {
          return problem("CLINIC_CLOSED", lang);
        }
        target.status = "Reserved";
        slot.status = "Open";
        notifyWaiting(slot.doctorId, localDate(slot.startsAt), now);
        appt.slotId = target.id;
        return Response.json(appointmentDto(appt, lang, features));
      }

      if (method === "POST" && third === "pay") {
        if (!features.onlinePayments) return off("onlinePayments");
        const input = await body();
        const total = appt.priceEgp == null ? 0 : Math.max(0, appt.priceEgp - appt.discountEgp);
        if (
          appt.status !== "Confirmed" ||
          slot.startsAt.getTime() <= now.getTime() ||
          appt.paymentStatus === "Paid" ||
          total <= 0
        ) {
          return problem("PAYMENT_NOT_ALLOWED", lang);
        }
        if (typeof input.returnUrl !== "string" || !/^https?:\/\//.test(input.returnUrl)) {
          return problem("VALIDATION_FAILED", lang, { status: 422 });
        }
        const payment: MockPayment = {
          id: newId("9"),
          appointmentId: appt.id,
          amountEgp: total,
          status: "Pending",
          polls: 0,
        };
        s.payments.push(payment);
        appt.paymentStatus = "Pending";
        // The demo checkout "pays" at once and sends the patient straight back.
        const sep = input.returnUrl.includes("?") ? "&" : "?";
        return Response.json({
          paymentId: payment.id,
          checkoutUrl: `${input.returnUrl}${sep}paymentId=${payment.id}&status=paid`,
        });
      }

      if (method === "POST" && third === "review") {
        if (!features.reviews) return off("reviews");
        const input = await body();
        const rating = Number(input.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          return problem("VALIDATION_FAILED", lang, { status: 422 });
        }
        if (appt.review) return problem("ALREADY_REVIEWED", lang);
        if (appt.status !== "Completed") return problem("NOT_REVIEWABLE", lang);
        const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 1000) : "";
        appt.review = {
          rating,
          comment: comment || undefined,
          createdAt: now.toISOString(),
        };
        return Response.json(appointmentDto(appt, lang, features), { status: 201 });
      }

      if (method === "GET" && third === "video") {
        if (!features.videoConsultation) return off("videoConsultation");
        if (appt.mode !== "Video" || appt.status !== "Confirmed") return problem("NOT_FOUND", lang);
        const opensAt = new Date(slot.startsAt.getTime() - VIDEO_OPENS_MINUTES * 60_000);
        const closesAt = new Date(slot.endsAt.getTime() + VIDEO_CLOSES_MINUTES * 60_000);
        if (now < opensAt || now > closesAt) return problem("VIDEO_NOT_OPEN", lang);
        return Response.json({
          joinUrl: `https://meet.jit.si/drbooking-${appt.id.replaceAll("-", "").slice(-12)}`,
          opensAt: opensAt.toISOString(),
          closesAt: closesAt.toISOString(),
        });
      }
    }
  }

  return problem("NOT_FOUND", lang);
}
