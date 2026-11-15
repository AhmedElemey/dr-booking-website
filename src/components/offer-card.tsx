"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import type { Promotion } from "@/lib/api/types";
import { formatEgp, formatNumber } from "@/lib/datetime";

import { btnSecondary, card } from "./ui";

function formatValidTo(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-EG", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

/** A public offer on the landing page: discount, validity and a copyable coupon code. */
export function OfferCard({ offer }: { offer: Promotion }) {
  const t = useTranslations("Offers");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the code is visible to copy by hand.
    }
  }

  const discount =
    offer.discountType === "Percent"
      ? t("percentOff", { value: formatNumber(offer.value, locale) })
      : t("fixedOff", { value: formatEgp(offer.value, locale) });

  return (
    <article className={`${card} flex h-full flex-col gap-3`}>
      <span className="self-start rounded-full bg-success-soft px-3 py-1 text-sm font-bold text-success">
        {discount}
      </span>
      <h3 className="text-lg font-bold">{offer.title}</h3>
      {offer.description ? <p className="text-sm text-muted">{offer.description}</p> : null}
      <p className="text-xs text-muted">{t("validUntil", { date: formatValidTo(offer.validTo, locale) })}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <code
          dir="ltr"
          className="rounded-lg border border-dashed border-primary px-3 py-2 text-sm font-bold tracking-wider"
        >
          {offer.code}
        </code>
        <button type="button" className={btnSecondary} onClick={() => void copy()}>
          {copied ? t("copied") : t("copy")}
        </button>
        <Link href="/doctors" className="text-sm font-semibold text-primary hover:underline">
          {t("bookNow")}
        </Link>
      </div>
    </article>
  );
}
