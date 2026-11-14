import { backendFetch } from "./api/backend";
import { ApiError } from "./api/errors";
import { clinicConfig, FEATURE_KEYS, type FeatureKey, type Features } from "./clinic-config";
import { routing } from "@/i18n/routing";

export { FEATURE_KEYS };
export type { FeatureKey, Features };

export const FEATURES_REVALIDATE_SECONDS = 60;
const FETCH_TIMEOUT_MS = 3000;
const RETRY_AFTER_FAILURE_SECONDS = 10;

/** Defaults from clinic.config.json, used when the API (or the console behind it) is unreachable. */
export function defaultFeatures(): Features {
  return { ...clinicConfig.features };
}

/** Merges an API payload over the defaults: unknown keys are ignored, missing or non-boolean keys fall back. */
export function normalizeFeatures(raw: unknown, defaults: Features = defaultFeatures()): Features {
  const source =
    raw && typeof raw === "object" && "features" in raw
      ? (raw as { features: unknown }).features
      : undefined;
  const result = { ...defaults };
  if (source && typeof source === "object") {
    for (const key of FEATURE_KEYS) {
      const value = (source as Record<string, unknown>)[key];
      if (typeof value === "boolean") result[key] = value;
    }
  }
  return result;
}

let cached: { at: number; value: Features } | undefined;

/** Test hook: forget the in-memory copy. */
export function resetFeaturesCache() {
  cached = undefined;
}

/**
 * Server-side feature switches from `GET /api/v1/features` (cached 60 s, in
 * memory and through the fetch cache). Never throws: failures fall back to the
 * last good copy, then to the clinic.config.json defaults.
 */
export async function getFeatures(now: number = Date.now()): Promise<Features> {
  if (cached && now - cached.at < FEATURES_REVALIDATE_SECONDS * 1000) return cached.value;
  try {
    const res = await backendFetch("/features", {
      headers: { Accept: "application/json" },
      next: { revalidate: FEATURES_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`features: ${res.status}`);
    const value = normalizeFeatures(await res.json());
    cached = { at: now, value };
    return value;
  } catch {
    const value = cached?.value ?? defaultFeatures();
    // Retry in 10 s rather than on every request while the API is down.
    cached = { at: now - (FEATURES_REVALIDATE_SECONDS - RETRY_AFTER_FAILURE_SECONDS) * 1000, value };
    return value;
  }
}

/** Locales the site serves: only Arabic when the English language switch is off. */
export function activeLocales(features: Pick<Features, "englishLanguage">) {
  return features.englishLanguage ? routing.locales : routing.locales.filter((l) => l !== "en");
}

/** True for a 403 problem the API sends when a disabled feature is called. */
export function isFeatureDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === "FEATURE_DISABLED";
}
