"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { Appointment } from "@/lib/api/types";
import { paymentReturnUrl, rememberPayment } from "@/lib/payments";

import { alertError, btnPrimary } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

/** True when "Pay online" applies: confirmed, still ahead, unpaid and something to pay. */
export function canPayOnline(appointment: Appointment, now: number = Date.now()): boolean {
  return (
    appointment.status === "Confirmed" &&
    new Date(appointment.endsAt).getTime() > now &&
    appointment.paymentStatus === "Unpaid" &&
    (appointment.totalEgp ?? 0) > 0
  );
}

/**
 * Starts a checkout and sends the browser to the provider. The provider returns
 * the patient to `/<locale>/appointments/<id>?payment=return`.
 */
export function PayButton({
  appointmentId,
  navigate = (url) => window.location.assign(url),
  className = btnPrimary,
}: {
  appointmentId: string;
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
      navigate(checkoutUrl);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" disabled={busy} onClick={() => void pay()} className={className}>
        {busy ? t("redirecting") : t("payOnline")}
      </button>
      {error ? (
        <p role="alert" className={`${alertError} w-full`}>
          {error}
        </p>
      ) : null}
    </>
  );
}
