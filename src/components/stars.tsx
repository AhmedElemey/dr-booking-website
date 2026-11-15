"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import type { Rating } from "@/lib/api/types";
import { formatNumber } from "@/lib/datetime";

const STAR_PATH =
  "M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9z";

function Star({ fill }: { fill: "full" | "half" | "empty" }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      {fill === "half" ? (
        <defs>
          <linearGradient id={id}>
            {/* The gradient follows the text direction, so half-stars fill from the start edge. */}
            <stop offset="50%" stopColor="var(--star)" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d={STAR_PATH}
        fill={fill === "full" ? "var(--star)" : fill === "half" ? `url(#${id})` : "none"}
        stroke="var(--star)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Five stars for a rating from 0 to 5 (rounded to halves). Decorative: pair with a text label. */
export function StarRow({ value }: { value: number }) {
  const halves = Math.round(Math.max(0, Math.min(5, value)) * 2);
  return (
    <span className="inline-flex items-center" dir="ltr" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          fill={halves >= (i + 1) * 2 ? "full" : halves === i * 2 + 1 ? "half" : "empty"}
        />
      ))}
    </span>
  );
}

/** "★★★★☆ 4.8 (23)" for doctor cards and the profile; renders nothing without reviews. */
export function RatingBadge({ rating }: { rating?: Rating | null }) {
  const t = useTranslations("Reviews");
  const locale = useLocale();
  if (!rating || rating.count <= 0) return null;
  const average = new Intl.NumberFormat(locale === "en" ? "en" : "ar-EG", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating.average);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm"
      aria-label={t("ratingLabel", { average, count: rating.count, n: formatNumber(rating.count, locale) })}
    >
      <StarRow value={rating.average} />
      <span className="font-bold">{average}</span>
      <span className="text-muted">({formatNumber(rating.count, locale)})</span>
    </span>
  );
}

/** Radio-group star picker for "Rate your visit". */
export function StarInput({
  value,
  onChange,
  name,
}: {
  value: number;
  onChange: (value: number) => void;
  name: string;
}) {
  const t = useTranslations("Reviews");
  return (
    <fieldset className="flex items-center gap-1" dir="ltr">
      <legend className="sr-only">{t("rateLegend")}</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className="cursor-pointer rounded-md p-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent">
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            className="sr-only"
            aria-label={t("starsOption", { count: n })}
          />
          <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true">
            <path
              d={STAR_PATH}
              fill={n <= value ? "var(--star)" : "none"}
              stroke="var(--star)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </label>
      ))}
    </fieldset>
  );
}
