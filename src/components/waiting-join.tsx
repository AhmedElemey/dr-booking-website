"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import { formatDateKey } from "@/lib/datetime";

import { FamilyPicker } from "./family-picker";
import { alertError, alertSuccess, btnPrimary } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

/** Shown on a day without open slots: join the doctor's waiting list for that date. */
export function WaitingJoin({
  doctorId,
  date,
  serviceId,
  familyAccounts = false,
}: {
  doctorId: string;
  date: string;
  serviceId?: string;
  familyAccounts?: boolean;
}) {
  const t = useTranslations("Waiting");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [joinedFor, setJoinedFor] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; signIn: boolean } | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await api.joinWaitingList({
        doctorId,
        date,
        serviceId,
        familyMemberId: memberId || undefined,
      });
      setJoinedFor(`${date}|${memberId}`);
    } catch (err) {
      setError({ message: errorMessage(err), signIn: err instanceof ApiError && err.status === 401 });
    } finally {
      setBusy(false);
    }
  }

  if (joinedFor === `${date}|${memberId}`) {
    return (
      <div className={`${alertSuccess} space-y-2`} role="status">
        <p className="font-semibold">{t("joined", { date: formatDateKey(date, locale) })}</p>
        <p>{t("joinedHint")}</p>
        <Link href="/account/waiting-list" className="font-semibold underline">
          {t("viewList")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-border bg-surface p-4">
      <p className="font-bold">{t("fullDayTitle")}</p>
      <p className="text-sm text-muted">{t("fullDayText")}</p>
      {familyAccounts ? (
        <FamilyPicker id={`w-for-${date}`} value={memberId} onChange={setMemberId} showManageLink={false} />
      ) : null}
      {error ? (
        <p role="alert" className={alertError}>
          {error.message}
          {error.signIn ? (
            <>
              {" "}
              <Link href="/account/appointments" className="font-semibold underline">
                {t("signIn")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <button type="button" disabled={busy} onClick={() => void join()} className={btnPrimary}>
        {busy ? t("joining") : t("join")}
      </button>
    </div>
  );
}
