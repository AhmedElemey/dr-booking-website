"use client";

import { useLocale, useTranslations } from "next-intl";

import type { Appointment, PaymentStatus } from "@/lib/api/types";
import { formatEgp } from "@/lib/datetime";

const STATUS_STYLE: Record<PaymentStatus, string> = {
  Unpaid: "bg-surface-muted text-muted",
  Pending: "bg-accent-soft text-accent",
  Paid: "bg-success-soft text-success",
  Refunded: "bg-surface-muted text-muted",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations("Payment");
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}

/** Price, discount and total of an appointment, with the payment status when online payments are on. */
export function PaymentSummary({
  appointment,
  showStatus,
}: {
  appointment: Pick<Appointment, "priceEgp" | "discountEgp" | "totalEgp" | "paymentStatus">;
  showStatus: boolean;
}) {
  const t = useTranslations("Payment");
  const locale = useLocale();
  const { priceEgp, discountEgp, totalEgp, paymentStatus } = appointment;
  if (priceEgp == null) return null;
  const discount = discountEgp ?? 0;
  const total = totalEgp ?? Math.max(0, priceEgp - discount);

  return (
    <div className="space-y-1 rounded-xl bg-surface-muted p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">{t("price")}</span>
        <span>{formatEgp(priceEgp, locale)}</span>
      </div>
      {discount > 0 ? (
        <div className="flex items-center justify-between gap-3 text-success">
          <span>{t("discount")}</span>
          <span>− {formatEgp(discount, locale)}</span>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-1 font-bold">
        <span>{t("total")}</span>
        <span>{formatEgp(total, locale)}</span>
      </div>
      {showStatus && paymentStatus ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-muted">{t("statusLabel")}</span>
          <PaymentStatusBadge status={paymentStatus} />
        </div>
      ) : null}
    </div>
  );
}
