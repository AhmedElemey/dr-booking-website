import type { NextRequest } from "next/server";

import { backendFetch } from "@/lib/api/backend";
import {
  notFoundResponse,
  readTokens,
  rejectCrossSite,
  toNextResponse,
} from "@/lib/auth/route-helpers";
import { isProxiedPath, proxyAuthenticated } from "@/lib/auth/session";

// Authenticated proxy: reads the httpOnly access cookie, adds the Bearer header,
// refreshes on 401 and forwards to the API (spec section 4, "Client storage").

export const dynamic = "force-dynamic";

async function handle(
  request: NextRequest,
  ctx: RouteContext<"/api/[...path]">,
) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;

  const { path } = await ctx.params;
  if (!isProxiedPath(path, request.method)) return notFoundResponse();

  const result = await proxyAuthenticated({
    path: `/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`,
    method: request.method,
    headers: request.headers,
    body: ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer(),
    tokens: readTokens(request),
    backend: backendFetch,
  });
  return toNextResponse(request, result);
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
