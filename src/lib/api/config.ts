const DEFAULT_API_BASE_URL = "http://localhost:5267";
const DEFAULT_SITE_URL = "http://localhost:3000";

/** Root of the Moonlight API, without the `/api/v1` suffix. */
export function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  return (raw && raw.trim() ? raw.trim() : DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

/** Public origin of this website (canonical URLs, sitemap, JSON-LD). */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  return (raw && raw.trim() ? raw.trim() : DEFAULT_SITE_URL).replace(/\/+$/, "");
}

/**
 * Demo mode: answer from in-memory fixtures instead of the backend. Off unless
 * `MOCK_API=1` is set explicitly, in every environment including production.
 */
export function isMockApi(): boolean {
  return process.env.MOCK_API === "1";
}
