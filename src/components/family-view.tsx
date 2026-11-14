"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import type { FamilyMember, FamilyMemberInput, FamilyRelation } from "@/lib/api/types";

import { AccountGate } from "./account-gate";
import { alertError, alertSuccess, btnDanger, btnGhost, btnPrimary, btnSecondary, card, inputClass, labelClass } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

export const MAX_FAMILY_MEMBERS = 10;
const RELATIONS: FamilyRelation[] = ["Child", "Spouse", "Parent", "Sibling", "Other"];

export function FamilyView() {
  return <AccountGate>{() => <FamilyList />}</AccountGate>;
}

type Draft = { fullName: string; relation: FamilyRelation; dateOfBirth: string; gender: "" | "Male" | "Female" };
const emptyDraft: Draft = { fullName: "", relation: "Child", dateOfBirth: "", gender: "" };

function FamilyList() {
  const t = useTranslations("Family");
  const common = useTranslations("Common");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();

  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => {
    setReloadKey((n) => n + 1);
    return Promise.resolve();
  }, []);

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
  }, [api, errorMessage, reloadKey]);

  function startEdit(member: FamilyMember | null) {
    setError(null);
    setFlash(null);
    setEditing(member ? member.id : "new");
    setDraft(
      member
        ? {
            fullName: member.fullName,
            relation: member.relation,
            dateOfBirth: member.dateOfBirth?.slice(0, 10) ?? "",
            gender: member.gender ?? "",
          }
        : emptyDraft,
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const fullName = draft.fullName.trim();
    if (!fullName) {
      setError(t("nameRequired"));
      return;
    }
    const input: FamilyMemberInput = {
      fullName,
      relation: draft.relation,
      dateOfBirth: draft.dateOfBirth || null,
      gender: draft.gender || null,
    };
    setBusy(true);
    setError(null);
    try {
      if (editing === "new") await api.addFamilyMember(input);
      else if (editing) await api.updateFamilyMember(editing, input);
      setFlash(editing === "new" ? t("added") : t("saved"));
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.deleteFamilyMember(id);
      setConfirmDelete(null);
      setFlash(t("removed"));
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (members === null && !error) {
    return (
      <p role="status" className="text-muted">
        {common("loading")}
      </p>
    );
  }

  const full = (members?.length ?? 0) >= MAX_FAMILY_MEMBERS;

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-muted">{t("intro", { max: MAX_FAMILY_MEMBERS })}</p>
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

      {members && members.length === 0 && editing === null ? (
        <div className={`${card} space-y-2 text-center`}>
          <p className="text-lg font-bold">{t("empty")}</p>
          <p className="text-muted">{t("emptyHint")}</p>
        </div>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-2">
        {(members ?? []).map((member) =>
          editing === member.id ? (
            <li key={member.id} className="md:col-span-2">
              <MemberForm draft={draft} setDraft={setDraft} busy={busy} onSubmit={save} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={member.id} className={`${card} space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{member.fullName}</h3>
                  <p className="text-sm font-medium text-accent">{t(`relation.${member.relation}`)}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {member.dateOfBirth ? (
                  <div>
                    <dt className="text-muted">{t("dateOfBirth")}</dt>
                    <dd className="font-medium">
                      {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-EG", {
                        timeZone: "UTC",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(`${member.dateOfBirth.slice(0, 10)}T00:00:00Z`))}
                    </dd>
                  </div>
                ) : null}
                {member.gender ? (
                  <div>
                    <dt className="text-muted">{t("gender")}</dt>
                    <dd className="font-medium">{t(`genderOption.${member.gender}`)}</dd>
                  </div>
                ) : null}
              </dl>
              {confirmDelete === member.id ? (
                <div className="space-y-2 rounded-xl bg-surface-muted p-3">
                  <p className="text-sm">{t("deleteConfirm", { name: member.fullName })}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} className={btnDanger} onClick={() => void remove(member.id)}>
                      {t("deleteYes")}
                    </button>
                    <button type="button" disabled={busy} className={btnSecondary} onClick={() => setConfirmDelete(null)}>
                      {common("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnSecondary} onClick={() => startEdit(member)}>
                    {t("edit")}
                  </button>
                  <button type="button" className={btnGhost} onClick={() => setConfirmDelete(member.id)}>
                    {t("delete")}
                  </button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>

      {editing === "new" ? (
        <MemberForm draft={draft} setDraft={setDraft} busy={busy} onSubmit={save} onCancel={() => setEditing(null)} />
      ) : full ? (
        <p className="text-sm text-muted">{t("limitReached", { max: MAX_FAMILY_MEMBERS })}</p>
      ) : (
        <button type="button" className={btnPrimary} onClick={() => startEdit(null)}>
          {t("add")}
        </button>
      )}
    </div>
  );
}

function MemberForm({
  draft,
  setDraft,
  busy,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Family");
  const common = useTranslations("Common");
  return (
    <form onSubmit={onSubmit} className={`${card} grid gap-4 sm:grid-cols-2`} noValidate>
      <div className="sm:col-span-2">
        <label htmlFor="fm-name" className={labelClass}>
          {t("fullName")}
        </label>
        <input
          id="fm-name"
          value={draft.fullName}
          onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
          maxLength={100}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="fm-relation" className={labelClass}>
          {t("relationLabel")}
        </label>
        <select
          id="fm-relation"
          value={draft.relation}
          onChange={(e) => setDraft({ ...draft, relation: e.target.value as FamilyRelation })}
          className={inputClass}
        >
          {RELATIONS.map((r) => (
            <option key={r} value={r}>
              {t(`relation.${r}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="fm-gender" className={labelClass}>
          {t("gender")}
        </label>
        <select
          id="fm-gender"
          value={draft.gender}
          onChange={(e) => setDraft({ ...draft, gender: e.target.value as Draft["gender"] })}
          className={inputClass}
        >
          <option value="">{t("genderUnset")}</option>
          <option value="Male">{t("genderOption.Male")}</option>
          <option value="Female">{t("genderOption.Female")}</option>
        </select>
      </div>
      <div>
        <label htmlFor="fm-dob" className={labelClass}>
          {t("dateOfBirth")}
        </label>
        <input
          id="fm-dob"
          type="date"
          value={draft.dateOfBirth}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
          className={inputClass}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {t("save")}
        </button>
        <button type="button" disabled={busy} className={btnSecondary} onClick={onCancel}>
          {common("cancel")}
        </button>
      </div>
    </form>
  );
}
