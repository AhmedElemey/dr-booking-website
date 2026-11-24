import { apiBaseUrl, isMockApi } from "./config";

export const API_PREFIX = "/api/v1";

export type BackendInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

/**
 * Server-side entry point to the Dr booking API. `path` is relative to `/api/v1`
 * (leading slash, optional query). With `MOCK_API=1` the request is answered
 * from in-memory fixtures; otherwise it is a plain `fetch` to the real API.
 */
export async function backendFetch(
  path: string,
  init: BackendInit = {},
): Promise<Response> {
  if (isMockApi()) {
    const { handleMockRequest } = await import("./mock/backend");
    return handleMockRequest(path, init);
  }
  return fetch(`${apiBaseUrl()}${API_PREFIX}${path}`, init);
}
