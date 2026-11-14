"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import type { WaitingEntry, WaitingStatus } from "@/lib/api/types";
import { formatDateKey } from "@/lib/datetime";

import { AccountGate } from "./account-gate";
import { DoctorAvatar } from "./doctor-card";
import { alertError, alertSuccess, btnGhost, btnPrimary, btnSecondary, card } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

const STATUS_STYLE: Record<WaitingStatus, string> = {
  Waiting: "bg-accent-soft text-accent",
  Notified: "bg-success-soft text-success",
  Booked: "bg-surface-muted text-muted",
  Cancelled: "bg-surface-muted text-muted",
  Expired: "bg-surface-muted text-muted",
};

export function WaitingListView() {
  return <AccountGate>{() => <WaitingEntries />}</AccountGate>;
}

function WaitingEntries() {
  const t = useTranslations("Waiting");
  const common = useTranslations("Common");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [entries, setEntries] = useState<WaitingEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => {
    setReloadKey((n) => n + 1);
    return Promise.resolve();
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .listWaitingList()
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, errorMessage, reloadKey]);

  async function leave(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.leaveWaitingList(id);
      setFlash(t("left"));
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (entries === null && !error) {
    return (
      <p role="status" className="text-muted">
        {common("loading")}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-muted">{t("intro")}</p>
      {flash ? (
        <p role="status" className={alertSuccess}>
          {flash}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={alertError}>
          {error}
        </p>
      ) : null}
      {entries && entries.length === 0 ? (
        <div className={`${card} space-y-3 text-center`}>
          <p className="text-lg font-bold">{t("empty")}</p>
          <p className="text-muted">{t("emptyHint")}</p>
          <Link href="/doctors" className={btnPrimary}>
            {t("findDoctor")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {(entries ?? []).map((entry) => {
            const active = entry.status === "Waiting" || entry.status === "Notified";
            return (
              <li key={entry.id} className={`${card} space-y-3`}>
                <div className="flex flex-wrap items-start gap-4">
                  <DoctorAvatar
                    name={entry.doctor.name}
                    photoUrl={entry.doctor.photoUrl}
                    alt={entry.doctor.name}
                    size="size-14"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold">{entry.doctor.name}</h3>
                    <p className="font-medium">{formatDateKey(entry.date, locale)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[entry.status]}`}>
                    {t(`status.${entry.status}`)}
                  </span>
                </div>
                {entry.status === "Notified" ? (
                  <p className="rounded-xl bg-success-soft px-3 py-2 text-sm text-success">{t("notifiedHint")}</p>
                ) : null}
                {active ? (
                  <div className="flex flex-wrap gap-2">
                    {entry.doctor.slug ? (
                      <Link
                        href={`/doctors/${entry.doctor.slug}/book`}
                        className={entry.status === "Notified" ? btnPrimary : btnSecondary}
                      >
                        {t("bookNow")}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyId === entry.id}
                      className={btnGhost}
                      onClick={() => void leave(entry.id)}
                    >
                      {t("leave")}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
