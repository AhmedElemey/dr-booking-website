import { backendFetch } from "./backend";
import { parseResponse } from "./errors";
import type {
  DoctorProfile,
  DoctorSearchParams,
  DoctorSummary,
  Paged,
  SlotsResponse,
  Specialty,
} from "./types";

// Public catalog reads for server components. They run on the server, so they
// call the API directly (spec section 4: "public catalog reads may call the API
// directly or render server-side") and are cached briefly.

const CATALOG_REVALIDATE_SECONDS = 60;

async function getJson<T>(path: string, locale: string): Promise<T> {
  const res = await backendFetch(path, {
    headers: { Accept: "application/json", "Accept-Language": locale },
    next: { revalidate: CATALOG_REVALIDATE_SECONDS },
  });
  return parseResponse<T>(res);
}

export function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getSpecialties(locale: string) {
  return getJson<Specialty[]>("/specialties", locale);
}

export function getCities(locale: string) {
  return getJson<string[]>("/cities", locale);
}

export function searchDoctors(locale: string, params: DoctorSearchParams = {}) {
  return getJson<Paged<DoctorSummary>>(`/doctors${buildQuery(params)}`, locale);
}

export function getDoctor(locale: string, idOrSlug: string) {
  return getJson<DoctorProfile>(
    `/doctors/${encodeURIComponent(idOrSlug)}`,
    locale,
  );
}

export function getDoctorSlots(
  locale: string,
  idOrSlug: string,
  from: string,
  to: string,
) {
  return getJson<SlotsResponse>(
    `/doctors/${encodeURIComponent(idOrSlug)}/slots${buildQuery({ from, to })}`,
    locale,
  );
}
