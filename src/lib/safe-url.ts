/**
 * Accepts only URLs that are safe to navigate to from a backend response:
 * `https:` anywhere, `http:` on localhost only. Returns the normalized URL or null.
 */
export function safeNavigationUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      return url.toString();
    }
  } catch {
    // Not an absolute URL.
  }
  return null;
}

/**
 * Where a record attachment link should point. The API serves attachments from an
 * authenticated path (`/api/v1/me/records/...`); the browser must go through this
 * site's cookie-authenticated proxy (`/api/me/records/...`). Anything else
 * (legacy absolute URLs) is passed through only when it is a safe http(s) URL.
 */
export function attachmentHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      path = url.pathname + url.search;
      if (!/^\/api\/v\d+\//.test(path)) return safeNavigationUrl(raw);
    } catch {
      return null;
    }
  }
  const match = /^\/api\/v\d+(\/me\/records\/.+)$/.exec(path);
  if (match) return `/api${match[1]}`;
  if (/^\/me\/records\//.test(path)) return `/api${path}`;
  if (/^\/api\/me\/records\//.test(path)) return path;
  return null;
}
