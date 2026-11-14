"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { StarInput, StarRow } from "./stars";
import { alertError, btnPrimary, btnSecondary, inputClass, labelClass } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

/** "Rate your visit" on a completed appointment: 1 to 5 stars and an optional comment. */
export function ReviewForm({
  appointmentId,
  onDone,
}: {
  appointmentId: string;
  onDone: (message: string) => void;
}) {
  const t = useTranslations("Reviews");
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (rating < 1) {
      setError(t("ratingRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.reviewAppointment(appointmentId, { rating, comment: comment.trim() || undefined });
      onDone(t("thanks"));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
        {t("rateVisit")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full space-y-3 rounded-xl bg-surface-muted p-4" noValidate>
      <h4 className="font-bold">{t("rateTitle")}</h4>
      <StarInput name={`rating-${appointmentId}`} value={rating} onChange={setRating} />
      <div>
        <label htmlFor={`review-${appointmentId}`} className={labelClass}>
          {t("commentLabel")}
        </label>
        <textarea
          id={`review-${appointmentId}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={t("commentPlaceholder")}
          className={inputClass}
        />
      </div>
      {error ? (
        <p role="alert" className={alertError}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? t("submitting") : t("submit")}
        </button>
        <button
          type="button"
          disabled={busy}
          className={btnSecondary}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          {t("later")}
        </button>
      </div>
    </form>
  );
}

/** The patient's own rating on a reviewed visit. */
export function YourRating({ review }: { review: { rating: number; comment?: string | null } }) {
  const t = useTranslations("Reviews");
  return (
    <div className="w-full space-y-1 rounded-xl bg-surface-muted p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        {t("yourRating")} <StarRow value={review.rating} />
      </p>
      {review.comment ? <p className="text-muted">{review.comment}</p> : null}
    </div>
  );
}

