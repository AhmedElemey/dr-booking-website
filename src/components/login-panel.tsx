"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";

import type { OtpVerifyResult } from "@/lib/api/types";
import { formatPlain } from "@/lib/datetime";
import { formatEgyptPhone, isolateLtr, normalizeEgyptPhone, toAsciiDigits } from "@/lib/phone";

import { alertError, btnGhost, btnPrimary, inputClass, labelClass } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

const RESEND_SECONDS = 60;

/** Phone + one-time-code sign-in. Tokens end up in httpOnly cookies via `/api/auth/*`. */
export function LoginPanel({
  onSuccess,
}: {
  onSuccess: (result: OtpVerifyResult) => void;
}) {
  const t = useTranslations("Login");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function sendCode(target: string) {
    setBusy(true);
    setError(null);
    try {
      await api.requestOtp(target);
      setPhone(target);
      setStep("code");
      setCode("");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onPhoneSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeEgyptPhone(phoneInput);
    if (!normalized) {
      setError(t("phoneInvalid"));
      return;
    }
    void sendCode(normalized);
  }

  async function onCodeSubmit(event: FormEvent) {
    event.preventDefault();
    const digits = toAsciiDigits(code).trim();
    if (!phone || !/^\d{6}$/.test(digits)) {
      setError(t("codeInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSuccess(await api.verifyOtp(phone, digits));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={onPhoneSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-phone" className={labelClass}>
            {t("phoneLabel")}
          </label>
          <input
            id="login-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder={t("phonePlaceholder")}
            aria-describedby="login-phone-hint"
            className={`${inputClass} text-start`}
          />
          <p id="login-phone-hint" className="mt-1 text-xs text-muted">
            {t("phoneHint")}
          </p>
        </div>
        {error ? (
          <p role="alert" className={alertError}>
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? t("sending") : t("sendCode")}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onCodeSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted">
        {t("codeSentTo", { phone: isolateLtr(phone ? formatEgyptPhone(phone) : "") })}
      </p>
      <div>
        <label htmlFor="login-code" className={labelClass}>
          {t("codeLabel")}
        </label>
        <input
          id="login-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
        />
      </div>
      {error ? (
        <p role="alert" className={alertError}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? t("verifying") : t("verify")}
        </button>
        <button
          type="button"
          disabled={busy || cooldown > 0}
          onClick={() => phone && void sendCode(phone)}
          className={btnGhost}
        >
          {cooldown > 0 ? t("resendIn", { seconds: formatPlain(cooldown, locale) }) : t("resend")}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setError(null);
          }}
          className={btnGhost}
        >
          {t("changeNumber")}
        </button>
      </div>
    </form>
  );
}
