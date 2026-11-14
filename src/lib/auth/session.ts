import type { TokenResponse } from "../api/types";

// Cookie/refresh logic of the website's backend-for-frontend. Tokens only ever
// live in httpOnly cookies; browser JavaScript never sees them. This module is
// pure (no Next.js imports) so it can be unit tested with a fake backend.

export const ACCESS_COOKIE = "ml_at";
export const REFRESH_COOKIE = "ml_rt";
export const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type Tokens = { accessToken?: string; refreshToken?: string };

export type TokenUpdate =
  | {
      type: "set";
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }
  | { type: "clear" };

export type BackendCall = (path: string, init: RequestInit) => Promise<Response>;

export type ProxyResult = { response: Response; tokenUpdate?: TokenUpdate };

type CookieJar = {
  set(name: string, value: string, options: CookieOptions): unknown;
  delete(name: string): unknown;
};

export type CookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

export function cookieOptions(secure: boolean, maxAge: number): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge };
}

/** Writes (or clears) the token cookies on a Next.js cookie jar. */
export function applyTokenUpdate(
  jar: CookieJar,
  update: TokenUpdate | undefined,
  secure: boolean,
) {
  if (!update) return;
  if (update.type === "clear") {
    jar.delete(ACCESS_COOKIE);
    jar.delete(REFRESH_COOKIE);
    return;
  }
  jar.set(
    ACCESS_COOKIE,
    update.accessToken,
    cookieOptions(secure, Math.max(update.expiresIn, 1)),
  );
  jar.set(
    REFRESH_COOKIE,
    update.refreshToken,
    cookieOptions(secure, REFRESH_MAX_AGE_SECONDS),
  );
}

export function tokenUpdateFrom(tokens: TokenResponse): TokenUpdate {
  return {
    type: "set",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  };
}

export function isSecureRequest(url: string, forwardedProto: string | null) {
  return forwardedProto
    ? forwardedProto.split(",")[0].trim() === "https"
    : url.startsWith("https:");
}

/** Browser-initiated mutations must come from this site (defence in depth next to SameSite=Lax). */
export function isSameOrigin(origin: string | null, host: string | null) {
  if (!origin) return true; // same-origin GETs and non-browser clients send none
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const PROXIED_ROOTS = new Set([
  "me",
  "appointments",
  "doctors",
  "specialties",
  "cities",
]);

/** Only patient/public endpoints are reachable through the browser proxy. */
export function isProxiedPath(segments: string[]): boolean {
  return (
    segments.length > 0 &&
    PROXIED_ROOTS.has(segments[0]) &&
    segments.every((s) => s !== "" && s !== "." && s !== ".." && !/[\\/]/.test(s))
  );
}

// Refresh tokens rotate on every use and reuse revokes the whole family, so the
// parallel requests of one page load (all carrying the same expired cookies)
// must share a single refresh call instead of racing each other.
const inflightRefresh = new Map<string, Promise<TokenResponse | null>>();
const RECENT_REFRESH_TTL_MS = 10_000;

export async function refreshTokens(
  refreshToken: string,
  backend: BackendCall,
): Promise<TokenResponse | null> {
  const existing = inflightRefresh.get(refreshToken);
  if (existing) return existing;

  const attempt = (async () => {
    try {
      const res = await backend("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      return (await res.json()) as TokenResponse;
    } catch {
      return null;
    }
  })();

  inflightRefresh.set(refreshToken, attempt);
  const timer = setTimeout(
    () => inflightRefresh.delete(refreshToken),
    RECENT_REFRESH_TTL_MS,
  );
  timer.unref?.();
  const result = await attempt;
  if (!result) {
    // Do not memoize failures: a later attempt may legitimately succeed.
    inflightRefresh.delete(refreshToken);
    clearTimeout(timer);
  }
  return result;
}

export function resetRefreshCache() {
  inflightRefresh.clear();
}

const FORWARDED_REQUEST_HEADERS = ["accept", "accept-language", "content-type"];

export type ProxyRequest = {
  /** Path below `/api/v1`, including the query string. */
  path: string;
  method: string;
  headers: Headers;
  body?: ArrayBuffer;
  tokens: Tokens;
  backend: BackendCall;
};

function toResponse(upstream: Response): Response {
  const headers = new Headers();
  const type = upstream.headers.get("content-type");
  if (type) headers.set("content-type", type);
  headers.set("cache-control", "no-store");
  const noBody = upstream.status === 204 || upstream.status === 304;
  return new Response(noBody ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}

/**
 * Forwards a request to the API with the cookie's access token as `Bearer`.
 * On `401` (or an already expired access cookie) it refreshes once, retries, and
 * reports the new tokens so the caller can set the cookies. A failed refresh
 * clears the session.
 */
export async function proxyAuthenticated(req: ProxyRequest): Promise<ProxyResult> {
  const send = (accessToken?: string) => {
    const headers = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = req.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
    return req.backend(req.path, {
      method: req.method,
      headers,
      body: req.body && req.body.byteLength > 0 ? req.body : undefined,
      cache: "no-store",
    });
  };

  let accessToken = req.tokens.accessToken;
  let tokenUpdate: TokenUpdate | undefined;

  const refresh = async (): Promise<boolean> => {
    if (!req.tokens.refreshToken) return false;
    const fresh = await refreshTokens(req.tokens.refreshToken, req.backend);
    if (!fresh) {
      tokenUpdate = { type: "clear" };
      accessToken = undefined;
      return false;
    }
    tokenUpdate = tokenUpdateFrom(fresh);
    accessToken = fresh.accessToken;
    return true;
  };

  // Access cookie expired by max-age but a refresh token remains: refresh first.
  if (!accessToken) await refresh();

  let upstream = await send(accessToken);
  if (upstream.status === 401 && req.tokens.refreshToken && !tokenUpdate) {
    if (await refresh()) upstream = await send(accessToken);
  }

  return { response: toResponse(upstream), tokenUpdate };
}
