"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import type { FamilyMember } from "@/lib/api/types";

import { inputClass, labelClass } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

/** "Booking for" select: the signed-in patient (empty value) or one of their family members. */
export function FamilyPicker({
  id = "b-for",
  value,
  onChange,
  showManageLink = true,
}: {
  id?: string;
  value: string;
  onChange: (memberId: string, member: FamilyMember | null) => void;
  showManageLink?: boolean;
}) {
  const t = useTranslations("Family");
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listFamily()
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, errorMessage]);

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {t("bookingFor")}
      </label>
      <select
        id={id}
        value={value}
        disabled={members === null}
        onChange={(e) =>
          onChange(e.target.value, members?.find((m) => m.id === e.target.value) ?? null)
        }
        className={inputClass}
      >
        <option value="">{t("myself")}</option>
        {(members ?? []).map((m) => (
          <option key={m.id} value={m.id}>
            {m.fullName} — {t(`relation.${m.relation}`)}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      {showManageLink ? (
        <p className="mt-1 text-xs text-muted">
          {members && members.length === 0 ? `${t("pickerEmpty")} ` : ""}
          <Link href="/account/family" className="font-medium text-primary hover:underline">
            {t("manageLink")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
