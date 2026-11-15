"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { Payment } from "@/lib/api/types";
import {
  isSettled,
  pollUntil,
  recallPayment,
  verdictOf,
  type PaymentReturn as ReturnInfo,
  type PollOptions,
} from "@/lib/payments";

import { PayButton } from "./pay-button";
import { alertError, alertSuccess, btnSecondary } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

type Result =
  | { status: "checking" }
  | { status: "done"; payment: Payment }
  | { status: "unknown" }
  | { status: "error"; message: string };

/**
 * Shown on `/appointments/<id>?payment=return`. The URL only says the patient came
 * back; the outcome is read from `GET /payments/<id>`, polled until it leaves Pending.
 */
export function PaymentReturn({
  appointmentId,
  info,
  onSettled,
  poll,
}: {
  appointmentId: string;
  info: ReturnInfo;
  /** Called once the payment is Paid, so the appointment can be reloaded. */
  onSettled?: () => void;
  poll?: PollOptions;
}) {
  const t = useTranslations("Payment");
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [result, setResult] = useState<Result>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);
  const settled = useRef(onSettled);
  useEffect(() => {
    settled.current = onSettled;
  });
  const pollRef = useRef(poll);

  useEffect(() => {
    let cancelled = false;
    const paymentId = info.paymentId ?? recallPayment(appointmentId);
    if (!paymentId) {
      queueMicrotask(() => {
        if (!cancelled) setResult({ status: "unknown" });
      });
      return () => {
        cancelled = true;
      };
    }
    pollUntil(() => api.getPayment(paymentId), isSettled, {
      ...pollRef.current,
      cancelled: () => cancelled,
    })
      .then((payment) => {
        if (cancelled) return;
        setResult({ status: "done", payment });
        if (payment.status === "Paid") settled.current?.();
      })
      .catch((err) => {
        if (!cancelled) setResult({ status: "error", message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [api, appointmentId, errorMessage, info.paymentId, attempt]);

  function recheck() {
    setResult({ status: "checking" });
    setAttempt((n) => n + 1);
  }

  if (result.status === "checking") {
    return (
      <p role="status" className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        {t("checking")}
      </p>
    );
  }
  if (result.status === "error") {
    return (
      <div className="space-y-2">
        <p role="alert" className={alertError}>
          {result.message}
        </p>
        <button type="button" className={btnSecondary} onClick={recheck}>
          {t("recheck")}
        </button>
      </div>
    );
  }
  if (result.status === "unknown") {
    return (
      <p role="status" className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        {t("unknown")}
      </p>
    );
  }

  const verdict = verdictOf(result.payment.status);
  if (verdict === "paid") {
    return (
      <p role="status" className={alertSuccess}>
        <strong>{t("paidTitle")}</strong> {t("paidText")}
      </p>
    );
  }
  if (verdict === "failed") {
    return (
      <div role="alert" className={`${alertError} space-y-3`}>
        <p>
          <strong>{t("failedTitle")}</strong> {t("failedText")}
        </p>
        <div className="flex flex-wrap gap-2">
          <PayButton appointmentId={appointmentId} className={btnSecondary} />
        </div>
      </div>
    );
  }
  if (verdict === "refunded") {
    return (
      <p role="status" className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        {t("refundedText")}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p role="status" className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        {t("stillPending")}
      </p>
      <button type="button" className={btnSecondary} onClick={recheck}>
        {t("recheck")}
      </button>
    </div>
  );
}
