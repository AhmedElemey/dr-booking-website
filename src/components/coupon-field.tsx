"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { CouponCheck } from "@/lib/api/types";
import { formatEgp } from "@/lib/datetime";

import { btnSecondary, inputClass, labelClass } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

const MIN_CODE_LENGTH = 3;
const TYPING_DELAY_MS = 600;

export type CouponState =
  | { status: "empty" }
  | { status: "checking" }
  | { status: "valid"; code: string; check: CouponCheck }
  | { status: "invalid"; message: string };

/**
 * Coupon code box with live validation against `POST /coupons/validate`: it checks
 * when the patient presses Apply (or Enter) and shortly after they stop typing, and
 * again when the doctor or service changes.
 */
export function CouponField({
  doctorId,
  serviceId,
  onChange,
}: {
  doctorId: string;
  serviceId?: string;
  onChange: (state: CouponState) => void;
}) {
  const t = useTranslations("Coupon");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState("");
  const [state, setState] = useState<CouponState>({ status: "empty" });
  const latest = useRef(0);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  function publish(next: CouponState) {
    setState(next);
    onChangeRef.current(next);
  }

  async function validate(raw: string) {
    const value = raw.trim().toUpperCase();
    const ticket = ++latest.current;
    if (!value) {
      publish({ status: "empty" });
      return;
    }
    publish({ status: "checking" });
    try {
      const check = await api.validateCoupon({ code: value, doctorId, serviceId });
      if (ticket !== latest.current) return;
      if (check.valid) {
        publish({ status: "valid", code: value, check });
      } else {
        publish({ status: "invalid", message: t(`reason.${reasonKey(check.reason)}`) });
      }
    } catch (err) {
      if (ticket !== latest.current) return;
      publish({ status: "invalid", message: errorMessage(err) });
    }
  }

  // Re-check an entered code when the service (and so the price) changes.
  const lastScope = useRef(`${doctorId}|${serviceId ?? ""}`);
  useEffect(() => {
    const scope = `${doctorId}|${serviceId ?? ""}`;
    if (scope === lastScope.current) return;
    lastScope.current = scope;
    if (!code.trim()) return;
    const id = setTimeout(() => void validate(code), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only on scope change
  }, [doctorId, serviceId]);

  // Live check shortly after typing stops.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onInput(value: string) {
    setCode(value);
    clearTimeout(timer.current);
    latest.current++;
    if (!value.trim()) {
      publish({ status: "empty" });
      return;
    }
    publish({ status: "empty" });
    if (value.trim().length >= MIN_CODE_LENGTH) {
      timer.current = setTimeout(() => void validate(value), TYPING_DELAY_MS);
    }
  }

  return (
    <div>
      <label htmlFor="b-coupon" className={labelClass}>
        {t("label")}
      </label>
      <div className="flex gap-2">
        <input
          id="b-coupon"
          value={code}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              clearTimeout(timer.current);
              void validate(code);
            }
          }}
          dir="ltr"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={20}
          placeholder={t("placeholder")}
          aria-describedby="b-coupon-status"
          className={`${inputClass} uppercase`}
        />
        <button
          type="button"
          className={btnSecondary}
          disabled={!code.trim() || state.status === "checking"}
          onClick={() => {
            clearTimeout(timer.current);
            void validate(code);
          }}
        >
          {t("apply")}
        </button>
      </div>
      <p id="b-coupon-status" role="status" className="mt-1.5 min-h-5 text-sm">
        {state.status === "checking" ? <span className="text-muted">{t("checking")}</span> : null}
        {state.status === "valid" ? (
          <span className="font-medium text-success">
            {t("applied", {
              code: state.code,
              discount: formatEgp(state.check.discountEgp, locale),
            })}
          </span>
        ) : null}
        {state.status === "invalid" ? <span className="text-danger">{state.message}</span> : null}
      </p>
    </div>
  );
}

function reasonKey(reason: string | null | undefined) {
  const known = ["NotFound", "Expired", "NotStarted", "Exhausted", "PerPatientLimit", "NotApplicable", "NoPrice"];
  return known.includes(reason ?? "") ? (reason as string) : "Unknown";
}
