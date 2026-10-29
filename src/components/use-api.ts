"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import { createApiClient } from "@/lib/api/client";
import { errorKey } from "@/lib/api/errors";

export function useApiClient() {
  const locale = useLocale();
  return useMemo(() => createApiClient(locale), [locale]);
}

/** Maps any thrown value to a localized, user-facing message keyed by the API error `code`. */
export function useErrorMessage() {
  const t = useTranslations("Errors");
  return useCallback((error: unknown) => t(errorKey(error)), [t]);
}
