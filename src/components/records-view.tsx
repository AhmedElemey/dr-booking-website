"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { MyRecords } from "@/lib/api/types";

import { AccountGate } from "./account-gate";
import { FamilyPicker } from "./family-picker";
import { alertError, card } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

export function RecordsView({ familyAccounts }: { familyAccounts: boolean }) {
  return <AccountGate>{() => <Records familyAccounts={familyAccounts} />}</AccountGate>;
}

const KIND_STYLE: Record<string, string> = {
  Diagnosis: "bg-danger-soft text-danger",
  Prescription: "bg-accent-soft text-accent",
  Note: "bg-surface-muted text-muted",
  Attachment: "bg-surface-muted text-muted",
};

function Records({ familyAccounts }: { familyAccounts: boolean }) {
  const t = useTranslations("Records");
  const common = useTranslations("Common");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [memberId, setMemberId] = useState("");
  const [data, setData] = useState<{ key: string; records: MyRecords } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyRecords(memberId || undefined)
      .then((records) => {
        if (!cancelled) {
          setError(null);
          setData({ key: memberId, records });
        }
      })
      .catch((err) => {
        if (!cancelled) setError({ key: memberId, message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [api, errorMessage, memberId]);

  const loading = !(data?.key === memberId) && !(error?.key === memberId);
  const records = data?.key === memberId ? data.records : null;
  const info = records?.medicalInfo;
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-EG", {
      timeZone: "Africa/Cairo",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));

  const infoRows: [string, string | null | undefined][] = info
    ? [
        [t("bloodType"), info.bloodType],
        [t("allergies"), info.allergies],
        [t("chronicConditions"), info.chronicConditions],
        [t("medications"), info.medications],
      ]
    : [];

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-muted">{t("intro")}</p>
      {familyAccounts ? (
        <div className="max-w-sm">
          <FamilyPicker id="r-for" value={memberId} onChange={setMemberId} showManageLink={false} />
        </div>
      ) : null}

      {loading ? (
        <p role="status" className="text-muted">
          {common("loading")}
        </p>
      ) : null}
      {error?.key === memberId ? (
        <p role="alert" className={alertError}>
          {error.message}
        </p>
      ) : null}

      {records ? (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t("medicalInfo")}</h2>
            {info && infoRows.some(([, value]) => value) ? (
              <dl className={`${card} grid gap-4 sm:grid-cols-2`}>
                {infoRows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-muted">{label}</dt>
                    <dd className="font-medium">{value || t("notRecorded")}</dd>
                  </div>
                ))}
                {info.updatedAt ? (
                  <p className="text-xs text-muted sm:col-span-2">{t("updated", { date: fmt(info.updatedAt) })}</p>
                ) : null}
              </dl>
            ) : (
              <p className="text-muted">{t("noMedicalInfo")}</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t("entries")}</h2>
            {records.entries.length === 0 ? (
              <p className="text-muted">{t("noEntries")}</p>
            ) : (
              <ul className="space-y-3">
                {records.entries.map((entry) => (
                  <li key={entry.id} className={`${card} space-y-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${KIND_STYLE[entry.kind] ?? KIND_STYLE.Note}`}>
                          {t(`kind.${entry.kind}`)}
                        </span>
                        <h3 className="font-bold">{entry.title}</h3>
                      </div>
                      <time dateTime={entry.createdAt} className="text-xs text-muted">
                        {fmt(entry.createdAt)}
                      </time>
                    </div>
                    {entry.body ? <p className="whitespace-pre-line text-muted">{entry.body}</p> : null}
                    {entry.doctor ? <p className="text-sm text-muted">{entry.doctor.name}</p> : null}
                    {entry.attachmentUrl ? (
                      <a
                        href={entry.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        {t("openAttachment")}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
