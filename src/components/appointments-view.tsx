"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { clinicConfig } from "@/lib/clinic-config";
import { ApiError } from "@/lib/api/errors";
import type { Appointment, User } from "@/lib/api/types";
import type { Features } from "@/lib/features";
import {
  formatAppointmentDate,
  formatAppointmentTime,
  formatDateKey,
  formatHHmm,
} from "@/lib/datetime";

import { DoctorAvatar } from "./doctor-card";
import { LoginPanel } from "./login-panel";
import { canPayOnline, PayButton } from "./pay-button";
import { PaymentStatusBadge, PaymentSummary } from "./payment-summary";
import { ReviewForm, YourRating } from "./review-form";
import { VideoBadge, VideoJoin } from "./video-join";
import { SlotPicker, type PickedSlot } from "./slot-picker";
import {
  alertError,
  alertSuccess,
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSecondary,
  card,
  inputClass,
  labelClass,
} from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

type View =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "clinic" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      user: User;
      upcoming: Appointment[];
      past: Appointment[];
    };

export function AppointmentsView({
  selfService = true,
  features = {},
}: {
  selfService?: boolean;
  /** Phase-2 feature switches; every extra on the cards is hidden unless its switch is on. */
  features?: Partial<Features>;
}) {
  const t = useTranslations("Account");
  const common = useTranslations("Common");
  const api = useApiClient();
  const errorMessage = useErrorMessage();

  const [view, setView] = useState<View>({ status: "loading" });
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [flash, setFlash] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await api.getMe();
        if (cancelled) return;
        if (user.role !== "Patient") {
          setView({ status: "clinic" });
          return;
        }
        const [upcoming, past] = await Promise.all([
          api.listAppointments("upcoming"),
          api.listAppointments("past"),
        ]);
        if (!cancelled) {
          setView({ status: "ready", user, upcoming: upcoming.items, past: past.items });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) setView({ status: "guest" });
        else if (err instanceof ApiError && err.status === 403) setView({ status: "clinic" });
        else setView({ status: "error", message: errorMessage(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, errorMessage, reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  async function signOut() {
    try {
      await api.logout();
    } finally {
      setFlash(null);
      setView({ status: "guest" });
    }
  }

  if (view.status === "loading") {
    return (
      <p role="status" className="text-muted">
        {common("loading")}
      </p>
    );
  }

  if (view.status === "guest") {
    return (
      <section className={`${card} max-w-lg space-y-4`}>
        <h2 className="text-xl font-bold">{t("loginTitle")}</h2>
        <p className="text-muted">{t("loginText")}</p>
        <LoginPanel
          onSuccess={() => {
            setView({ status: "loading" });
            reload();
          }}
        />
      </section>
    );
  }

  if (view.status === "clinic") {
    return <p className={alertError}>{t("clinicAccount")}</p>;
  }

  if (view.status === "error") {
    return (
      <div className="space-y-3">
        <p role="alert" className={alertError}>
          {t("loadError")} {view.message}
        </p>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            setView({ status: "loading" });
            reload();
          }}
        >
          {common("retry")}
        </button>
      </div>
    );
  }

  const list = tab === "upcoming" ? view.upcoming : view.past;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-medium">
          {t("hello", { name: view.user.fullName ?? "" })}
        </p>
        <button type="button" onClick={() => void signOut()} className={btnGhost}>
          {t("signOut")}
        </button>
      </div>

      {flash ? (
        <p role="status" className={alertSuccess}>
          {flash}
        </p>
      ) : null}

      <div role="tablist" className="inline-flex rounded-full bg-surface-muted p-1">
        {(["upcoming", "past"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-5 py-2 text-sm font-semibold ${
              tab === key ? "bg-surface shadow-sm" : "text-muted"
            }`}
          >
            {key === "upcoming" ? t("tabUpcoming") : t("tabPast")}
          </button>
        ))}
      </div>

      {tab === "upcoming" ? (
        <p className="text-sm text-muted">
          {selfService ? t("windowHint") : t("selfServiceOff", { phone: clinicConfig.supportPhone })}
        </p>
      ) : null}

      {list.length === 0 ? (
        <div className={`${card} space-y-3 text-center`}>
          <p className="text-lg font-bold">
            {tab === "upcoming" ? t("noUpcoming") : t("noPast")}
          </p>
          {tab === "upcoming" ? <p className="text-muted">{t("noUpcomingHint")}</p> : null}
          <Link href="/doctors" className={btnPrimary}>
            {t("findDentist")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {list.map((appointment) => (
            <li key={appointment.id}>
              <AppointmentCard
                appointment={appointment}
                upcoming={tab === "upcoming"}
                selfService={selfService}
                features={features}
                onChanged={(message) => {
                  setFlash(message);
                  reload();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const INSURANCE_STYLE = {
  Pending: "bg-accent-soft text-accent",
  Approved: "bg-success-soft text-success",
  Rejected: "bg-danger-soft text-danger",
} as const;

const STATUS_STYLE: Record<Appointment["status"], string> = {
  Pending: "bg-accent-soft text-accent",
  Confirmed: "bg-success-soft text-success",
  Cancelled: "bg-danger-soft text-danger",
  Completed: "bg-surface-muted text-muted",
  NoShow: "bg-danger-soft text-danger",
};

export function AppointmentCard({
  appointment,
  upcoming,
  selfService,
  features = {},
  onChanged,
}: {
  appointment: Appointment;
  upcoming: boolean;
  selfService: boolean;
  features?: Partial<Features>;
  onChanged: (message: string) => void;
}) {
  const t = useTranslations("Account");
  const common = useTranslations("Common");
  const family = useTranslations("Family");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();

  const [mode, setMode] = useState<"idle" | "cancel" | "reschedule">("idle");
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<PickedSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // The API lists a visit under "upcoming" while it is still ahead; a Pending visit can
  // only be cancelled (rescheduling needs a confirmed slot on the backend).
  const active = upcoming && (appointment.status === "Confirmed" || appointment.status === "Pending");
  const reschedulable = upcoming && appointment.status === "Confirmed";

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setMode("idle");
      setPicked(null);
      setReason("");
      setBusy(false);
      onChanged(success);
    } catch (err) {
      setError(errorMessage(err));
      if (
        err instanceof ApiError &&
        (err.code === "SLOT_TAKEN" || err.code === "SLOT_UNAVAILABLE")
      ) {
        setPicked(null);
        setRefreshKey((n) => n + 1);
      }
      setBusy(false);
    }
  }

  const mapsHref =
    appointment.clinic.latitude != null && appointment.clinic.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${appointment.clinic.latitude},${appointment.clinic.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointment.clinic.address)}`;

  return (
    <article className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-start gap-4">
        <DoctorAvatar
          name={appointment.doctor.name}
          photoUrl={appointment.doctor.photoUrl}
          alt={appointment.doctor.name}
          size="size-14"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold">
            <Link href={`/doctors/${appointment.doctor.slug}`} className="hover:underline">
              {appointment.doctor.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {appointment.clinic.name} — {appointment.clinic.address}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {features.videoConsultation && appointment.mode === "Video" ? <VideoBadge /> : null}
            {features.familyAccounts && appointment.familyMember ? (
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold">
                {t("forMember", {
                  name: appointment.familyMember.fullName,
                  relation: family(`relation.${appointment.familyMember.relation}`),
                })}
              </span>
            ) : null}
            {features.insurance && appointment.insurance ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${INSURANCE_STYLE[appointment.insurance.status]}`}
              >
                {t("insuranceBadge", {
                  provider: appointment.insurance.provider.name,
                  status: t(`insuranceStatus.${appointment.insurance.status}`),
                })}
              </span>
            ) : null}
            {features.onlinePayments && appointment.paymentStatus && appointment.status !== "Cancelled" ? (
              <PaymentStatusBadge status={appointment.paymentStatus} />
            ) : null}
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[appointment.status]}`}
        >
          {t(`status.${appointment.status}`)}
        </span>
      </div>

      <p className="text-xl font-bold">
        {formatAppointmentDate(appointment, locale)} — {formatAppointmentTime(appointment, locale)}
      </p>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {appointment.service ? (
          <div>
            <dt className="text-muted">{t("service")}</dt>
            <dd className="font-medium">{appointment.service.name}</dd>
          </div>
        ) : null}
        {features.insurance && appointment.insurance ? (
          <div>
            <dt className="text-muted">{t("insurance")}</dt>
            <dd className="font-medium">
              {appointment.insurance.provider.name} —{" "}
              <span dir="ltr">{appointment.insurance.memberNumber}</span>
              {appointment.insurance.note ? ` (${appointment.insurance.note})` : ""}
            </dd>
          </div>
        ) : null}
        {appointment.patientNote ? (
          <div>
            <dt className="text-muted">{t("note")}</dt>
            <dd className="font-medium">{appointment.patientNote}</dd>
          </div>
        ) : null}
        {appointment.status === "Cancelled" ? (
          <div>
            <dt className="text-muted">
              {appointment.cancelledBy === "Clinic" ? t("cancelledByClinic") : t("cancelledByYou")}
            </dt>
            {appointment.cancelReason ? (
              <dd className="font-medium">
                {t("reason")}: {appointment.cancelReason}
              </dd>
            ) : null}
          </div>
        ) : null}
      </dl>

      {(features.onlinePayments || (features.promotions && (appointment.discountEgp ?? 0) > 0)) &&
      appointment.status !== "Cancelled" ? (
        <PaymentSummary appointment={appointment} showStatus={Boolean(features.onlinePayments)} />
      ) : null}

      {features.reviews && appointment.review ? <YourRating review={appointment.review} /> : null}

      {error ? (
        <p role="alert" className={alertError}>
          {error}
        </p>
      ) : null}

      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          {features.onlinePayments && canPayOnline(appointment) ? (
            <PayButton appointmentId={appointment.id} pending={appointment.paymentStatus === "Pending"} />
          ) : null}
          {features.videoConsultation ? <VideoJoin appointment={appointment} /> : null}
          {features.reviews && appointment.canReview ? (
            <ReviewForm appointmentId={appointment.id} onDone={onChanged} />
          ) : null}
          <Link href={`/appointments/${appointment.id}`} className={btnSecondary}>
            {t("details")}
          </Link>
          <a href={`tel:${appointment.clinic.phone}`} className={btnSecondary}>
            {t("call")}
          </a>
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
            {t("directions")}
          </a>
          {active && selfService ? (
            <>
              {reschedulable ? (
                <button type="button" className={btnSecondary} onClick={() => setMode("reschedule")}>
                  {t("reschedule")}
                </button>
              ) : null}
              <button type="button" className={btnGhost} onClick={() => setMode("cancel")}>
                {t("cancel")}
              </button>
            </>
          ) : appointment.status === "Cancelled" || appointment.status === "Completed" ? (
            <Link href={`/doctors/${appointment.doctor.slug}/book`} className={btnPrimary}>
              {t("rebook")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {mode === "cancel" ? (
        <div className="space-y-3 rounded-xl bg-surface-muted p-4">
          <h4 className="font-bold">{t("cancelTitle")}</h4>
          <p className="text-sm text-muted">{t("cancelText")}</p>
          <div>
            <label htmlFor={`reason-${appointment.id}`} className={labelClass}>
              {t("cancelReason")}
            </label>
            <input
              id={`reason-${appointment.id}`}
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className={btnDanger}
              onClick={() =>
                void run(
                  () => api.cancelAppointment(appointment.id, reason.trim() || undefined),
                  t("cancelled"),
                )
              }
            >
              {t("cancelConfirm")}
            </button>
            <button
              type="button"
              disabled={busy}
              className={btnSecondary}
              onClick={() => {
                setMode("idle");
                setError(null);
              }}
            >
              {t("keep")}
            </button>
          </div>
        </div>
      ) : null}

      {mode === "reschedule" ? (
        <div className="space-y-4 rounded-xl bg-surface-muted p-4">
          <h4 className="font-bold">{t("rescheduleTitle", { name: appointment.doctor.name })}</h4>
          <SlotPicker
            doctorSlug={appointment.doctor.slug}
            timezone={appointment.timezone}
            selectedSlotId={picked?.slot.id}
            onSelect={setPicked}
            refreshKey={refreshKey}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !picked}
              className={btnPrimary}
              onClick={() =>
                picked &&
                void run(
                  () => api.rescheduleAppointment(appointment.id, picked.slot.id),
                  t("rescheduled"),
                )
              }
            >
              {t("rescheduleConfirm")}
              {picked ? ` — ${formatDateKey(picked.date, locale, "short")} ${formatHHmm(picked.slot.local, locale)}` : ""}
            </button>
            <button
              type="button"
              disabled={busy}
              className={btnSecondary}
              onClick={() => {
                setMode("idle");
                setPicked(null);
                setError(null);
              }}
            >
              {common("cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
