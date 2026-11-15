"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Link } from "@/i18n/navigation";
import { brandName, clinicConfig } from "@/lib/clinic-config";
import { ApiError } from "@/lib/api/errors";
import type { BookingInput } from "@/lib/api/client";
import type { Appointment, AppointmentMode, DoctorProfile, User } from "@/lib/api/types";
import type { Features } from "@/lib/features";
import {
  formatAppointmentDate,
  formatAppointmentTime,
  formatDateKey,
  formatEgp,
  formatHHmm,
  formatPlain,
} from "@/lib/datetime";
import { buildIcs } from "@/lib/ics";
import { formatEgyptPhone, isolateLtr } from "@/lib/phone";

import { CouponField, type CouponState } from "./coupon-field";
import { FamilyPicker } from "./family-picker";
import { LoginPanel } from "./login-panel";
import { canPayOnline, PayButton } from "./pay-button";
import { PaymentSummary } from "./payment-summary";
import { SlotPicker, type PickedSlot } from "./slot-picker";
import { VideoBadge } from "./video-join";
import {
  alertError,
  btnGhost,
  btnPrimary,
  btnSecondary,
  card,
  inputClass,
  labelClass,
} from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

type Step = "slot" | "login" | "confirm" | "done";
const STEPS: Step[] = ["slot", "login", "confirm", "done"];
const STEP_LABEL_KEY = {
  slot: "stepSlot",
  login: "stepLogin",
  confirm: "stepConfirm",
  done: "stepDone",
} as const;

export function BookingFlow({
  doctor,
  features = {},
}: {
  doctor: DoctorProfile;
  /** Phase-2 feature switches; each extra step of the flow is hidden unless its switch is on. */
  features?: Partial<Features>;
}) {
  const t = useTranslations("Booking");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();

  const [step, setStep] = useState<Step>("slot");
  const [picked, setPicked] = useState<PickedSlot | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [note, setNote] = useState("");
  const [fullName, setFullName] = useState("");
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [memberId, setMemberId] = useState("");
  const [mode, setMode] = useState<AppointmentMode>("InPerson");
  const [insuranceId, setInsuranceId] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const [coupon, setCoupon] = useState<CouponState>({ status: "empty" });

  const offersVideo = Boolean(features.videoConsultation && doctor.offersVideo);
  const insuranceOptions = features.insurance ? (doctor.insuranceProviders ?? []) : [];

  function enterConfirm(next: User) {
    if (next.role !== "Patient") {
      setError(t("clinicAccount"));
      setStep("login");
      return;
    }
    setUser(next);
    setFullName(next.fullName ?? "");
    setError(null);
    setStep("confirm");
  }

  // Guests browse freely; login happens only once a slot is chosen.
  async function continueFromSlot() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      enterConfirm(user ?? (await api.getMe()));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStep("login");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!picked || !user) return;
    const name = fullName.trim();
    if (!name) {
      setError(t("fullNameRequired"));
      return;
    }
    if (insuranceId && !memberNumber.trim()) {
      setError(t("memberNumberRequired"));
      return;
    }
    if (coupon.status === "checking" || coupon.status === "invalid") {
      setError(coupon.status === "invalid" ? coupon.message : t("couponChecking"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (name !== (user.fullName ?? "")) {
        setUser(await api.updateMe({ fullName: name }));
      }
      // Feature-only fields are sent only while their feature is on.
      const input: BookingInput = {
        slotId: picked.slot.id,
        serviceId: serviceId || undefined,
        patientNote: note.trim() || undefined,
        ...(features.familyAccounts && memberId ? { familyMemberId: memberId } : {}),
        ...(offersVideo ? { mode } : {}),
        ...(insuranceOptions.length > 0 && insuranceId
          ? { insurance: { providerId: insuranceId, memberNumber: memberNumber.trim() } }
          : {}),
        ...(features.promotions && coupon.status === "valid" ? { couponCode: coupon.code } : {}),
      };
      const booked = await api.bookAppointment(input);
      setAppointment(booked);
      setStep("done");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setStep("login");
      } else if (
        err instanceof ApiError &&
        (err.code === "SLOT_TAKEN" || err.code === "SLOT_UNAVAILABLE" || err.code === "CLINIC_CLOSED")
      ) {
        // Someone else got there first: pick again from fresh availability.
        setPicked(null);
        setRefreshKey((n) => n + 1);
        setStep("slot");
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function downloadIcs() {
    if (!appointment) return;
    const blob = new Blob(
      [buildIcs(appointment, t("calendarSummary", { name: doctor.name }), {
          name: brandName(locale),
          slug: clinicConfig.slug,
        })],
      { type: "text/calendar;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${clinicConfig.slug}-appointment.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const currentIndex = STEPS.indexOf(step);
  const service = doctor.services.find((s) => s.id === serviceId);
  const basePrice = service?.priceEgp ?? doctor.consultationFeeEgp ?? null;
  const discount = coupon.status === "valid" ? coupon.check.discountEgp : 0;
  const total = basePrice == null ? null : Math.max(0, basePrice - discount);
  const showPrice = basePrice != null && Boolean(features.onlinePayments || features.promotions);

  return (
    <div className="space-y-8">
      <ol aria-label={t("progress")} className="flex flex-wrap gap-2">
        {STEPS.map((s, index) => (
          <li
            key={s}
            aria-current={s === step ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${
              s === step
                ? "bg-primary text-primary-foreground"
                : index < currentIndex
                  ? "bg-accent-soft text-accent"
                  : "bg-surface-muted text-muted"
            }`}
          >
            <span aria-hidden="true">
              {formatPlain(index + 1, locale)}
            </span>
            {t(STEP_LABEL_KEY[s])}
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" className={alertError}>
          {error}
        </p>
      ) : null}

      {step === "slot" ? (
        <section className="space-y-6">
          <SlotPicker
            doctorSlug={doctor.slug}
            timezone={doctor.clinic.timezone}
            selectedSlotId={picked?.slot.id}
            onSelect={(next) => {
              setPicked(next);
              setError(null);
            }}
            refreshKey={refreshKey}
            features={features}
            serviceId={serviceId || undefined}
          />
          {picked ? (
            <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
              <div>
                <p className="text-sm text-muted">{t("selected")}</p>
                <p className="font-bold">
                  {formatDateKey(picked.date, locale)} — {formatHHmm(picked.slot.local, locale)}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void continueFromSlot()}
                className={btnPrimary}
              >
                {t("continue")}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === "login" ? (
        <section className={`${card} max-w-lg space-y-4`}>
          <h2 className="text-xl font-bold">{t("loginTitle")}</h2>
          <p className="text-muted">{t("loginText")}</p>
          <LoginPanel
            onSuccess={({ user: signedIn }) => {
              enterConfirm(signedIn);
            }}
          />
          <button type="button" className={btnGhost} onClick={() => setStep("slot")}>
            {t("changeSlot")}
          </button>
        </section>
      ) : null}

      {step === "confirm" && picked && user ? (
        <form onSubmit={confirm} className="grid gap-6 lg:grid-cols-[1fr_20rem]" noValidate>
          <div className={`${card} space-y-5`}>
            <p className="text-sm text-muted">
              {t("signedInAs", { phone: isolateLtr(formatEgyptPhone(user.phone)) })}
            </p>

            <div>
              <label htmlFor="b-name" className={labelClass}>
                {t("fullName")}
              </label>
              <input
                id="b-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                aria-describedby="b-name-hint"
                className={inputClass}
              />
              <p id="b-name-hint" className="mt-1 text-xs text-muted">
                {t("fullNameHint")}
              </p>
            </div>

            {features.familyAccounts ? (
              <FamilyPicker value={memberId} onChange={setMemberId} />
            ) : null}

            {doctor.services.length > 0 ? (
              <div>
                <label htmlFor="b-service" className={labelClass}>
                  {t("service")}
                </label>
                <select
                  id="b-service"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t("noService")}</option>
                  {doctor.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {offersVideo ? (
              <fieldset>
                <legend className={labelClass}>{t("visitType")}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["InPerson", "Video"] as const).map((option) => (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                        mode === option ? "border-primary bg-accent-soft" : "border-border bg-surface"
                      }`}
                    >
                      <input
                        type="radio"
                        name="b-mode"
                        value={option}
                        checked={mode === option}
                        onChange={() => setMode(option)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-semibold">{t(`mode.${option}`)}</span>
                        <span className="text-muted">{t(`modeHint.${option}`)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {insuranceOptions.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="b-insurance" className={labelClass}>
                    {t("insurance")}
                  </label>
                  <select
                    id="b-insurance"
                    value={insuranceId}
                    onChange={(e) => setInsuranceId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t("noInsurance")}</option>
                    {insuranceOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                {insuranceId ? (
                  <div>
                    <label htmlFor="b-member-number" className={labelClass}>
                      {t("memberNumber")}
                    </label>
                    <input
                      id="b-member-number"
                      value={memberNumber}
                      onChange={(e) => setMemberNumber(e.target.value)}
                      dir="ltr"
                      maxLength={40}
                      autoComplete="off"
                      className={inputClass}
                    />
                  </div>
                ) : null}
                <p className="text-xs text-muted sm:col-span-2">{t("insuranceHint")}</p>
              </div>
            ) : null}

            {features.promotions ? (
              <CouponField doctorId={doctor.id} serviceId={serviceId || undefined} onChange={setCoupon} />
            ) : null}

            <div>
              <label htmlFor="b-note" className={labelClass}>
                {t("note")}
              </label>
              <textarea
                id="b-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t("notePlaceholder")}
                className={inputClass}
              />
            </div>
          </div>

          <aside className={`${card} space-y-4 self-start`}>
            <h2 className="font-bold">{t("summary")}</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">{t("doctor")}</dt>
                <dd className="font-semibold">{doctor.name}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("clinic")}</dt>
                <dd className="font-semibold">{doctor.clinic.name}</dd>
                <dd className="text-muted">{doctor.clinic.address}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("dateTime")}</dt>
                <dd className="font-semibold">
                  {formatDateKey(picked.date, locale)} — {formatHHmm(picked.slot.local, locale)}
                </dd>
              </div>
              {offersVideo && mode === "Video" ? (
                <div>
                  <dt className="text-muted">{t("visitType")}</dt>
                  <dd>
                    <VideoBadge />
                  </dd>
                </div>
              ) : null}
              {service?.priceEgp != null && !showPrice ? (
                <div>
                  <dt className="text-muted">{service.name}</dt>
                  <dd>{formatEgp(service.priceEgp, locale)}</dd>
                </div>
              ) : null}
            </dl>
            {showPrice && basePrice != null && total != null ? (
              <PaymentSummary
                appointment={{ priceEgp: basePrice, discountEgp: discount, totalEgp: total }}
                showStatus={false}
              />
            ) : null}
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
              {features.onlinePayments ? t("payAtClinicOrOnline") : t("payAtClinic")}
            </p>
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
              {busy ? t("confirming") : t("confirm")}
            </button>
            <button
              type="button"
              disabled={busy}
              className={`${btnGhost} w-full`}
              onClick={() => setStep("slot")}
            >
              {t("changeSlot")}
            </button>
          </aside>
        </form>
      ) : null}

      {step === "done" && appointment ? (
        <section className={`${card} max-w-xl space-y-5`} aria-live="polite">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-success-soft text-2xl text-success"
            >
              ✓
            </span>
            <div>
              <h2 className="text-xl font-bold">{t("successTitle")}</h2>
              <p className="text-sm text-muted">{t("successText")}</p>
            </div>
          </div>
          <dl className="space-y-3 rounded-xl bg-surface-muted p-4 text-sm">
            <div>
              <dt className="text-muted">{t("doctor")}</dt>
              <dd className="font-semibold">{appointment.doctor.name}</dd>
            </div>
            {features.familyAccounts && appointment.familyMember ? (
              <div>
                <dt className="text-muted">{t("bookedFor")}</dt>
                <dd className="font-semibold">{appointment.familyMember.fullName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted">{t("dateTime")}</dt>
              <dd className="font-semibold">
                {formatAppointmentDate(appointment, locale)} —{" "}
                {formatAppointmentTime(appointment, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("clinic")}</dt>
              <dd className="font-semibold">{appointment.clinic.name}</dd>
              <dd className="text-muted">{appointment.clinic.address}</dd>
            </div>
          </dl>
          {appointment.mode === "Video" && features.videoConsultation ? (
            <p className="flex items-center gap-2 text-sm">
              <VideoBadge /> <span className="text-muted">{t("videoNote")}</span>
            </p>
          ) : null}
          {features.onlinePayments || (features.promotions && (appointment.discountEgp ?? 0) > 0) ? (
            <PaymentSummary appointment={appointment} showStatus={Boolean(features.onlinePayments)} />
          ) : null}
          <p className="text-sm text-muted">
            {features.onlinePayments && canPayOnline(appointment)
              ? t("payAtClinicOrOnline")
              : t("payAtClinic")}
          </p>
          <div className="flex flex-wrap gap-3">
            {features.onlinePayments && canPayOnline(appointment) ? (
              <PayButton appointmentId={appointment.id} pending={appointment.paymentStatus === "Pending"} />
            ) : null}
            <button type="button" onClick={downloadIcs} className={btnSecondary}>
              {t("addToCalendar")}
            </button>
            <Link href="/account/appointments" className={btnPrimary}>
              {t("viewAppointments")}
            </Link>
            <Link href="/doctors" className={btnGhost}>
              {t("backToDoctors")}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
