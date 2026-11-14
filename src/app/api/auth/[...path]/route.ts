import type { NextRequest } from "next/server";

import { backendFetch } from "@/lib/api/backend";
import { parseAuthAction, proxyAuth } from "@/lib/auth/auth-proxy";
import {
  notFoundResponse,
  readTokens,
  rejectCrossSite,
  toNextResponse,
} from "@/lib/auth/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/auth/[...path]">,
) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;

  const { path } = await ctx.params;
  const action = parseAuthAction(path);
  if (!action) return notFoundResponse();

  const result = await proxyAuth({
    action,
    headers: request.headers,
    body: await request.text(),
    tokens: readTokens(request),
    backend: backendFetch,
  });
  return toNextResponse(request, result);
}
