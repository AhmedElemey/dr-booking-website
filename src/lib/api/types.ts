// Response shapes of the Moonlight API (spec section 4). Public read responses are
// already localized by the `Accept-Language` header, so names are single strings.

export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type Specialty = { id: string; name: string };

export type ClinicSummary = {
  id: string;
  name: string;
  city: string;
  address?: string;
};

export type DoctorSummary = {
  id: string;
  slug: string;
  name: string;
  photoUrl?: string | null;
  specialty: Specialty;
  clinic: ClinicSummary;
  yearsExperience?: number | null;
  consultationFeeEgp?: number | null;
};

export type Clinic = ClinicSummary & {
  address: string;
  phone: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone: string;
};

export type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  priceEgp?: number | null;
};

export type DoctorProfile = Omit<DoctorSummary, "clinic"> & {
  bio?: string | null;
  clinic: Clinic;
  services: Service[];
};

export type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  /** Wall-clock start in the clinic timezone, `HH:mm`. */
  local: string;
};

export type SlotDay = { date: string; slots: Slot[] };

export type SlotsResponse = {
  doctorId: string;
  timezone: string;
  days: SlotDay[];
};

export type AppointmentStatus =
  | "Confirmed"
  | "Cancelled"
  | "Completed"
  | "NoShow";

export type Appointment = {
  id: string;
  status: AppointmentStatus;
  slotId: string;
  startsAt: string;
  endsAt: string;
  /** Clinic wall-clock start, ISO local date-time (`2026-11-02T09:00:00`). */
  startsAtLocal: string;
  timezone: string;
  doctor: { id: string; slug: string; name: string; photoUrl?: string | null };
  clinic: {
    id: string;
    name: string;
    address: string;
    phone: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  service?: Service | null;
  patientNote?: string | null;
  cancelledBy?: "Patient" | "Clinic" | null;
  cancelReason?: string | null;
};

export type User = {
  id: string;
  phone: string;
  fullName: string | null;
  role: "Patient" | "Doctor" | "ClinicStaff" | "PlatformAdmin";
  preferredLanguage: "ar" | "en";
  doctorId?: string | null;
  clinicId?: string | null;
};

export type OtpVerifyResult = {
  isNewUser: boolean;
  user: User;
};

/** Raw token response of `POST /auth/otp/verify` and `POST /auth/refresh`. */
export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser?: boolean;
  user?: User;
};

export type DoctorSearchParams = {
  specialtyId?: string;
  city?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};
