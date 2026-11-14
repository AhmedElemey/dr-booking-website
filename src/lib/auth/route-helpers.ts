import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  applyTokenUpdate,
  isSameOrigin,
  isSecureRequest,
  type ProxyResult,
  type Tokens,
} from "./session";

export function readTokens(request: NextRequest): Tokens {
  return {
    accessToken: request.cookies.get(ACCESS_COOKIE)?.value,
    refreshToken: request.cookies.get(REFRESH_COOKIE)?.value,
  };
}

/** Rejects cross-site browser mutations; `null` means the request may proceed. */
export function rejectCrossSite(request: NextRequest): Response | null {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (isSameOrigin(request.headers.get("origin"), host)) return null;
  return Response.json(
    { status: 403, code: "FORBIDDEN", title: "Cross-site request rejected" },
    { status: 403 },
  );
}

/** Turns a proxy result into a `NextResponse` carrying the cookie updates. */
export function toNextResponse(
  request: NextRequest,
  { response, tokenUpdate }: ProxyResult,
): NextResponse {
  const out = new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
  const secure = isSecureRequest(
    request.url,
    request.headers.get("x-forwarded-proto"),
  );
  applyTokenUpdate(out.cookies, tokenUpdate, secure);
  return out;
}

export function notFoundResponse(): Response {
  return Response.json(
    { status: 404, code: "NOT_FOUND", title: "Not found" },
    { status: 404 },
  );
}
