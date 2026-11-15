"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { Appointment } from "@/lib/api/types";
import { paymentReturnUrl, rememberPayment } from "@/lib/payments";
import { safeNavigationUrl } from "@/lib/safe-url";

import { alertError, btnPrimary } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

/**
 * True when "Pay online" applies: confirmed, not yet started (the API refuses a
 * payment once the slot has begun), unpaid or with an abandoned checkout
 * (`Pending` never expires, and a new `pay` supersedes it), and something to pay.
 */
export function canPayOnline(appointment: Appointment, now: number = Date.now()): boolean {
  return (
    appointment.status === "Confirmed" &&
    new Date(appointment.startsAt).getTime() > now &&
    (appointment.paymentStatus === "Unpaid" || appointment.paymentStatus === "Pending") &&
    (appointment.totalEgp ?? 0) > 0
  );
}

/**
 * Starts a checkout and sends the browser to the provider. The provider returns
 * the patient to `/<locale>/appointments/<id>?payment=return`.
 */
export function PayButton({
  appointmentId,
  pending = false,
  navigate = (url) => window.location.assign(url),
  className = btnPrimary,
}: {
  appointmentId: string;
  /** The appointment already has an unfinished checkout: label the button "Continue payment". */
  pending?: boolean;
  navigate?: (url: string) => void;
  className?: string;
}) {
  const t = useTranslations("Payment");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const returnUrl = paymentReturnUrl(window.location.origin, locale, appointmentId);
      const { paymentId, checkoutUrl } = await api.startPayment(appointmentId, returnUrl);
      rememberPayment(appointmentId, paymentId);
      const safe = safeNavigationUrl(checkoutUrl);
      if (!safe) throw new Error("Unsafe checkout URL");
      navigate(safe);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" disabled={busy} onClick={() => void pay()} className={className}>
        {busy ? t("redirecting") : pending ? t("continuePayment") : t("payOnline")}
      </button>
      {error ? (
        <p role="alert" className={`${alertError} w-full`}>
          {error}
        </p>
      ) : null}
    </>
  );
}
