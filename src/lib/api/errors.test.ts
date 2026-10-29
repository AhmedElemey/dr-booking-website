import { describe, expect, it } from "vitest";

import { ApiError, errorFromResponse, errorKey, parseResponse } from "./errors";

const problem = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json" },
  });

describe("parseResponse", () => {
  it("returns the JSON body on success and undefined on 204", async () => {
    expect(await parseResponse(Response.json({ a: 1 }))).toEqual({ a: 1 });
    expect(await parseResponse(new Response(null, { status: 204 }))).toBeUndefined();
  });

  it("throws an ApiError carrying the stable code and field errors", async () => {
    const res = problem(
      { code: "VALIDATION_FAILED", detail: "Bad", errors: { phone: ["invalid"] } },
      400,
    );
    const error = await parseResponse(res).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      message: "Bad",
      fieldErrors: { phone: ["invalid"] },
    });
  });
});

describe("errorFromResponse", () => {
  it("falls back to a status-based code for non-JSON bodies", async () => {
    expect((await errorFromResponse(new Response("<html>", { status: 502 }))).code).toBe(
      "INTERNAL_ERROR",
    );
    expect((await errorFromResponse(new Response("", { status: 401 }))).code).toBe("UNAUTHORIZED");
    expect((await errorFromResponse(new Response("", { status: 429 }))).code).toBe("RATE_LIMITED");
  });
});

describe("errorKey", () => {
  it("maps known codes, unknown codes and network failures to message keys", () => {
    expect(errorKey(new ApiError(409, "SLOT_TAKEN", "x"))).toBe("SLOT_TAKEN");
    expect(errorKey(new ApiError(418, "TEAPOT", "x"))).toBe("UNKNOWN");
    expect(errorKey(new TypeError("fetch failed"))).toBe("NETWORK_ERROR");
    expect(errorKey("boom")).toBe("UNKNOWN");
  });
});
