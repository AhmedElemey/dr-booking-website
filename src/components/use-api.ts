"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import { createApiClient } from "@/lib/api/client";
import { ApiError, couponReasonKey, errorKey } from "@/lib/api/errors";
import { clinicConfig } from "@/lib/clinic-config";

export function useApiClient() {
  const locale = useLocale();
  return useMemo(() => createApiClient(locale), [locale]);
}

/** Maps any thrown value to a localized, user-facing message keyed by the API error `code`. */
export function useErrorMessage() {
  const t = useTranslations("Errors");
  const coupon = useTranslations("Coupon");
  return useCallback(
    (error: unknown) =>
      // A refused coupon explains itself through the API's `reason`.
      error instanceof ApiError && error.code === "COUPON_INVALID"
        ? coupon(`reason.${couponReasonKey(error)}`)
        : t(errorKey(error), { phone: clinicConfig.supportPhone }),
    [t, coupon],
  );
}
