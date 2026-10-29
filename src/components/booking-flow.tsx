"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import type { Appointment, DoctorProfile, User } from "@/lib/api/types";
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

import { LoginPanel } from "./login-panel";
import { SlotPicker, type PickedSlot } from "./slot-picker";
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

export function BookingFlow({ doctor }: { doctor: DoctorProfile }) {
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
    setBusy(true);
    setError(null);
    try {
      if (name !== (user.fullName ?? "")) {
        setUser(await api.updateMe({ fullName: name }));
      }
      const booked = await api.bookAppointment({
        slotId: picked.slot.id,
        serviceId: serviceId || undefined,
        patientNote: note.trim() || undefined,
      });
      setAppointment(booked);
      setStep("done");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setStep("login");
      } else if (
        err instanceof ApiError &&
        (err.code === "SLOT_TAKEN" || err.code === "SLOT_UNAVAILABLE")
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
      [buildIcs(appointment, t("calendarSummary", { name: doctor.name }))],
      { type: "text/calendar;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "moonlight-appointment.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  const currentIndex = STEPS.indexOf(step);
  const service = doctor.services.find((s) => s.id === serviceId);

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
          />
          {picked ? (
            <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
              <div>
                <p className="text-sm text-muted">{t("selected")}</p>
                <p className="font-bold">
                  {formatDateKey(picked.date, locale)} · {formatHHmm(picked.slot.local, locale)}
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
                  {formatDateKey(picked.date, locale)} · {formatHHmm(picked.slot.local, locale)}
                </dd>
              </div>
              {service?.priceEgp != null ? (
                <div>
                  <dt className="text-muted">{service.name}</dt>
                  <dd>{formatEgp(service.priceEgp, locale)}</dd>
                </div>
              ) : null}
            </dl>
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
              {t("payAtClinic")}
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
            <div>
              <dt className="text-muted">{t("dateTime")}</dt>
              <dd className="font-semibold">
                {formatAppointmentDate(appointment, locale)} ·{" "}
                {formatAppointmentTime(appointment, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("clinic")}</dt>
              <dd className="font-semibold">{appointment.clinic.name}</dd>
              <dd className="text-muted">{appointment.clinic.address}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted">{t("payAtClinic")}</p>
          <div className="flex flex-wrap gap-3">
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
