import { parseResponse } from "./errors";
import type {
  Appointment,
  OtpVerifyResult,
  Paged,
  SlotsResponse,
  User,
} from "./types";

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
    updateMe: (patch: { fullName?: string; preferredLanguage?: "ar" | "en" }) =>
      call<User>("/me", { method: "PUT", body: patch }),

    getSlots: (doctor: string, from: string, to: string) =>
      call<SlotsResponse>(
        `/doctors/${encodeURIComponent(doctor)}/slots?from=${from}&to=${to}`,
      ),

    bookAppointment: (input: {
      slotId: string;
      serviceId?: string;
      patientNote?: string;
    }) => call<Appointment>("/appointments", { method: "POST", body: input }),
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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
