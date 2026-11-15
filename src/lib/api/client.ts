import { parseResponse } from "./errors";
import type {
  Appointment,
  AppointmentMode,
  CouponCheck,
  FamilyMember,
  FamilyMemberInput,
  MyRecords,
  OtpVerifyResult,
  Paged,
  PayStart,
  Payment,
  Review,
  SlotsResponse,
  User,
  VideoAccess,
  WaitingEntry,
} from "./types";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * `GET /me/records` is specified as "entries with visibleToPatient=true + own medical
 * info"; accept `entries` or `records` for the list and keep only visible entries.
 */
export function normalizeRecords(raw: unknown): MyRecords {
  const source = isObject(raw) ? raw : {};
  const list = Array.isArray(source.entries)
    ? source.entries
    : Array.isArray(source.records)
      ? source.records
      : [];
  const entries = list.filter(
    (e): e is MyRecords["entries"][number] =>
      isObject(e) &&
      typeof e.id === "string" &&
      typeof e.title === "string" &&
      e.visibleToPatient !== false,
  );
  return {
    medicalInfo: isObject(source.medicalInfo) ? (source.medicalInfo as MyRecords["medicalInfo"]) : null,
    entries,
  };
}

/** Everything a patient can send when booking; feature-only fields are omitted when their feature is off. */
export type BookingInput = {
  slotId: string;
  serviceId?: string;
  patientNote?: string;
  familyMemberId?: string;
  mode?: AppointmentMode;
  insurance?: { providerId: string; memberNumber: string };
  couponCode?: string;
};

// Browser-side API client. Every call goes to this site's own `/api/*` route
// handlers (never to the API host), which attach the httpOnly-cookie token.

export type Fetcher = typeof fetch;

export function createApiClient(locale: string, fetcher: Fetcher = fetch) {
  async function call<T>(
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const res = await fetcher(`/api${path}`, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Accept-Language": locale,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    return parseResponse<T>(res);
  }

  return {
    requestOtp: (phone: string) =>
      call<void>("/auth/otp/request", { method: "POST", body: { phone } }),
    verifyOtp: (phone: string, code: string) =>
      call<OtpVerifyResult>("/auth/otp/verify", {
        method: "POST",
        body: { phone, code },
      }),
    logout: () => call<{ ok: true }>("/auth/logout", { method: "POST", body: {} }),

    getMe: () => call<User>("/me"),
    updateMe: (patch: {
      fullName?: string;
      preferredLanguage?: "ar" | "en";
      whatsAppOptIn?: boolean;
      marketingOptIn?: boolean;
    }) =>
      call<User>("/me", { method: "PUT", body: patch }),

    getSlots: (doctor: string, from: string, to: string) =>
      call<SlotsResponse>(
        `/doctors/${encodeURIComponent(doctor)}/slots?from=${from}&to=${to}`,
      ),

    bookAppointment: (input: BookingInput) =>
      call<Appointment>("/appointments", { method: "POST", body: input }),
    getAppointment: (id: string) => call<Appointment>(`/appointments/${id}`),
    listAppointments: (scope: "upcoming" | "past", page = 1, pageSize = 50) =>
      call<Paged<Appointment>>(
        `/appointments?scope=${scope}&page=${page}&pageSize=${pageSize}`,
      ),
    cancelAppointment: (id: string, reason?: string) =>
      call<Appointment>(`/appointments/${id}/cancel`, {
        method: "POST",
        body: reason ? { reason } : {},
      }),
    rescheduleAppointment: (id: string, slotId: string) =>
      call<Appointment>(`/appointments/${id}/reschedule`, {
        method: "POST",
        body: { slotId },
      }),

    // Family accounts
    listFamily: () => call<FamilyMember[]>("/me/family"),
    addFamilyMember: (input: FamilyMemberInput) =>
      call<FamilyMember>("/me/family", { method: "POST", body: input }),
    updateFamilyMember: (id: string, input: FamilyMemberInput) =>
      call<FamilyMember>(`/me/family/${id}`, { method: "PUT", body: input }),
    deleteFamilyMember: (id: string) => call<void>(`/me/family/${id}`, { method: "DELETE" }),

    // Waiting list
    joinWaitingList: (input: {
      doctorId: string;
      date: string;
      serviceId?: string;
      familyMemberId?: string;
    }) => call<WaitingEntry>("/waiting-list", { method: "POST", body: input }),
    listWaitingList: () => call<WaitingEntry[]>("/waiting-list"),
    leaveWaitingList: (id: string) => call<void>(`/waiting-list/${id}`, { method: "DELETE" }),

    // Online payments
    startPayment: (appointmentId: string, returnUrl: string) =>
      call<PayStart>(`/appointments/${appointmentId}/pay`, {
        method: "POST",
        body: { returnUrl },
      }),
    getPayment: (id: string) => call<Payment>(`/payments/${encodeURIComponent(id)}`),

    // Promotions
    validateCoupon: (input: { code: string; doctorId: string; serviceId?: string }) =>
      call<CouponCheck>("/coupons/validate", { method: "POST", body: input }),

    // Reviews
    reviewAppointment: (id: string, input: { rating: number; comment?: string }) =>
      call<unknown>(`/appointments/${id}/review`, { method: "POST", body: input }),
    getDoctorReviews: (doctor: string, page = 1) =>
      call<Paged<Review>>(`/doctors/${encodeURIComponent(doctor)}/reviews?page=${page}`),

    // Video consultation
    getVideoAccess: (id: string) => call<VideoAccess>(`/appointments/${id}/video`),

    // Patient records
    getMyRecords: async (familyMemberId?: string) =>
      normalizeRecords(
        await call<unknown>(
          `/me/records${familyMemberId ? `?familyMemberId=${encodeURIComponent(familyMemberId)}` : ""}`,
        ),
      ),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
