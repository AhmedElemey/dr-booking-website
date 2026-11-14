"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { Paged, Review } from "@/lib/api/types";
import { formatNumber } from "@/lib/datetime";

import { StarRow } from "./stars";
import { alertError, btnSecondary, card } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

function formatReviewDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-EG", {
    timeZone: "Africa/Cairo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Published reviews of a doctor: the first page comes from the server, "Show more" loads the rest. */
export function ReviewsList({ doctorSlug, initial }: { doctorSlug: string; initial: Paged<Review> }) {
  const t = useTranslations("Reviews");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMore = items.length < initial.totalCount;

  async function more() {
    setBusy(true);
    setError(null);
    try {
      const next = await api.getDoctorReviews(doctorSlug, page + 1);
      setItems((current) => [...current, ...next.items]);
      setPage(next.page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {items.map((review, index) => (
          <li key={`${review.createdAt}-${index}`} className={`${card} space-y-2`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <StarRow value={review.rating} />
                <span className="sr-only">{t("starsOption", { count: review.rating })}</span>
                <span>{review.patientFirstName}</span>
              </p>
              <time dateTime={review.createdAt} className="text-xs text-muted">
                {formatReviewDate(review.createdAt, locale)}
              </time>
            </div>
            {review.comment ? <p className="text-muted">{review.comment}</p> : null}
            {review.reply ? (
              <div className="rounded-xl bg-surface-muted p-3 text-sm">
                <p className="font-semibold">{t("clinicReply")}</p>
                <p className="text-muted">{review.reply}</p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className={alertError}>
          {error}
        </p>
      ) : null}
      {hasMore ? (
        <button type="button" disabled={busy} onClick={() => void more()} className={btnSecondary}>
          {busy ? t("loadingMore") : t("showMore", { n: formatNumber(initial.totalCount - items.length, locale) })}
        </button>
      ) : null}
    </div>
  );
}
