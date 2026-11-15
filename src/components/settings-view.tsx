"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { hasSettings } from "@/lib/account";
import type { Features } from "@/lib/features";
import { formatEgyptPhone, isolateLtr } from "@/lib/phone";

import { AccountGate } from "./account-gate";
import { alertError, alertSuccess, card } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

export function SettingsView({ features }: { features: Partial<Features> }) {
  return <AccountGate>{(user) => <Settings user={user} features={features} />}</AccountGate>;
}

function Toggle({
  label,
  hint,
  checked,
  busy,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div>
        <p id={id} className="font-semibold">
          {label}
        </p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={busy}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${
            checked ? "end-0.5" : "start-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function Settings({
  user,
  features,
}: {
  user: import("@/lib/api/types").User;
  features: Partial<Features>;
}) {
  const t = useTranslations("Settings");
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [prefs, setPrefs] = useState({
    whatsAppOptIn: user.whatsAppOptIn ?? true,
    marketingOptIn: user.marketingOptIn ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function update(patch: Partial<typeof prefs>) {
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      const saved = await api.updateMe(patch);
      setPrefs({
        whatsAppOptIn: saved.whatsAppOptIn ?? prefs.whatsAppOptIn,
        marketingOptIn: saved.marketingOptIn ?? prefs.marketingOptIn,
        ...patch,
      });
      setFlash(t("saved"));
    } catch (err) {
      setPrefs(previous);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const showMarketing = hasSettings(features);

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-muted">
        {t("signedInAs", {
          name: user.fullName ?? "",
          phone: isolateLtr(formatEgyptPhone(user.phone)),
        })}
      </p>
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
      <section className={`${card} divide-y divide-border py-1`} aria-labelledby="settings-messages">
        <h2 id="settings-messages" className="pt-3 text-lg font-bold">
          {t("messagesTitle")}
        </h2>
        {features.whatsappReminders ? (
          <Toggle
            label={t("whatsapp")}
            hint={t("whatsappHint")}
            checked={prefs.whatsAppOptIn}
            busy={busy}
            onChange={(next) => void update({ whatsAppOptIn: next })}
          />
        ) : null}
        {showMarketing ? (
          <Toggle
            label={t("offers")}
            hint={t("offersHint")}
            checked={prefs.marketingOptIn}
            busy={busy}
            onChange={(next) => void update({ marketingOptIn: next })}
          />
        ) : null}
      </section>
    </div>
  );
}
