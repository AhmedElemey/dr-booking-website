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

export type Named = { id: string; name: string };

/** `rating` is null when reviews are off or the doctor has none yet. */
export type Rating = { average: number; count: number };

export type DoctorSummary = {
  id: string;
  slug: string;
  name: string;
  photoUrl?: string | null;
  specialty: Specialty;
  clinic: ClinicSummary;
  yearsExperience?: number | null;
  consultationFeeEgp?: number | null;
  /** Reviews feature. */
  rating?: Rating | null;
  /** Video consultation feature. */
  offersVideo?: boolean;
  /** Insurance feature: providers this doctor accepts (empty when the feature is off). */
  insuranceProviders?: Named[];
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

/** Holiday calendar feature: a date the clinic is closed, with its name. */
export type ClosedDate = { date: string; name: string };

export type SlotsResponse = {
  doctorId: string;
  timezone: string;
  days: SlotDay[];
  closedDates?: ClosedDate[];
};

export type AppointmentStatus =
  | "Pending"
  | "Confirmed"
  | "Cancelled"
  | "Completed"
  | "NoShow";

export type AppointmentMode = "InPerson" | "Video";
export type PaymentStatus = "Unpaid" | "Pending" | "Paid" | "Refunded";
export type InsuranceStatus = "Pending" | "Approved" | "Rejected";
export type FamilyRelation = "Child" | "Spouse" | "Parent" | "Sibling" | "Other";

export type FamilyMemberRef = { id: string; fullName: string; relation: FamilyRelation };

export type AppointmentInsurance = {
  provider: Named;
  memberNumber: string;
  status: InsuranceStatus;
  note?: string | null;
};

export type Appointment = {
  id: string;
  status: AppointmentStatus;
  slotId: string;
  startsAt: string;
  endsAt: string;
  /** Clinic wall-clock start with offset (`2026-11-02T09:00:00+02:00`). */
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
  /** Video consultation feature. */
  mode?: AppointmentMode;
  /** Online payments feature (always present from the API, meaningful only when on). */
  priceEgp?: number | null;
  discountEgp?: number | null;
  totalEgp?: number | null;
  paymentStatus?: PaymentStatus;
  /** Family accounts feature. */
  familyMember?: FamilyMemberRef | null;
  /** Insurance feature. */
  insurance?: AppointmentInsurance | null;
  /** Reviews feature. */
  canReview?: boolean;
  review?: { rating: number; comment?: string | null } | null;
};

export type FamilyMember = {
  id: string;
  fullName: string;
  relation: FamilyRelation;
  dateOfBirth?: string | null;
  gender?: "Male" | "Female" | null;
  createdAt?: string;
};

export type FamilyMemberInput = {
  fullName: string;
  relation: FamilyRelation;
  dateOfBirth?: string | null;
  gender?: "Male" | "Female" | null;
};

export type WaitingStatus = "Waiting" | "Notified" | "Booked" | "Cancelled" | "Expired";

export type WaitingEntry = {
  id: string;
  doctor: { id: string; slug?: string; name: string; photoUrl?: string | null };
  date: string;
  status: WaitingStatus;
  notifiedAt?: string | null;
};

export type PaymentOutcome = "Pending" | "Paid" | "Failed" | "Refunded" | "Cancelled";

export type Payment = {
  id: string;
  appointmentId: string;
  amountEgp: number;
  status: PaymentOutcome;
};

export type PayStart = { paymentId: string; checkoutUrl: string };

export type InsuranceProvider = Named;

export type CouponReason =
  | "NotFound"
  | "Expired"
  | "NotStarted"
  | "Exhausted"
  | "PerPatientLimit"
  | "NotApplicable"
  | "NoPrice";

export type CouponCheck = {
  valid: boolean;
  discountEgp: number;
  totalEgp: number;
  reason?: CouponReason | null;
};

export type Promotion = {
  code: string;
  title: string;
  description?: string | null;
  discountType: "Percent" | "Fixed";
  value: number;
  validTo: string;
  doctorId?: string | null;
  serviceId?: string | null;
};

export type Review = {
  rating: number;
  comment?: string | null;
  patientFirstName: string;
  createdAt: string;
  reply?: string | null;
};

export type VideoAccess = { joinUrl: string; opensAt: string; closesAt: string };

export type MedicalInfo = {
  bloodType?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  medications?: string | null;
  updatedAt?: string | null;
};

export type RecordKind = "Note" | "Diagnosis" | "Prescription" | "Attachment";

export type RecordEntry = {
  id: string;
  kind: RecordKind;
  title: string;
  body?: string | null;
  attachmentUrl?: string | null;
  /** Flat name as the API sends it. */
  doctorName?: string | null;
  /** Nested form, kept for the demo backend. */
  doctor?: { id: string; name: string } | null;
  createdAt: string;
};

/** `GET /me/records`: own medical info plus the entries the clinic made visible. */
export type MyRecords = {
  medicalInfo: MedicalInfo | null;
  entries: RecordEntry[];
};

export type User = {
  id: string;
  phone: string;
  fullName: string | null;
  role: "Patient" | "Doctor" | "ClinicStaff" | "PlatformAdmin";
  preferredLanguage: "ar" | "en";
  doctorId?: string | null;
  clinicId?: string | null;
  /** WhatsApp reminders feature. */
  whatsAppOptIn?: boolean;
  /** Offers and recall messages. */
  marketingOptIn?: boolean;
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
  insuranceProviderId?: string;
  page?: number;
  pageSize?: number;
};
