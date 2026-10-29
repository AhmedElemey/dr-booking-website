import { describe, expect, it, vi } from "vitest";

import { parseAuthAction, proxyAuth } from "./auth-proxy";
import type { BackendCall } from "./session";

const user = {
  id: "u1",
  phone: "+201012345678",
  fullName: null,
  role: "Patient",
  preferredLanguage: "ar",
};

function run(
  action: Parameters<typeof proxyAuth>[0]["action"],
  backend: BackendCall,
  tokens = {},
  body = "{}",
) {
  return proxyAuth({
    action,
    headers: new Headers({ "accept-language": "en" }),
    body,
    tokens,
    backend,
  });
}

describe("parseAuthAction", () => {
  it("accepts only the OTP and logout actions", () => {
    expect(parseAuthAction(["otp", "request"])).toBe("otp/request");
    expect(parseAuthAction(["otp", "verify"])).toBe("otp/verify");
    expect(parseAuthAction(["logout"])).toBe("logout");
    expect(parseAuthAction(["refresh"])).toBeNull();
    expect(parseAuthAction(["otp", "request", "x"])).toBeNull();
  });
});

describe("proxyAuth", () => {
  it("turns verified tokens into cookies and keeps them out of the response body", async () => {
    const backend = vi.fn().mockResolvedValue(
      Response.json({
        accessToken: "a",
        refreshToken: "r",
        expiresIn: 900,
        isNewUser: true,
        user,
      }),
    );

    const { response, tokenUpdate } = await run(
      "otp/verify",
      backend,
      {},
      JSON.stringify({ phone: "+201012345678", code: "123456" }),
    );

    expect(tokenUpdate).toEqual({
      type: "set",
      accessToken: "a",
      refreshToken: "r",
      expiresIn: 900,
    });
    const body = await response.json();
    expect(body).toEqual({ isNewUser: true, user });
    expect(JSON.stringify(body)).not.toContain("refreshToken");
    expect(backend.mock.calls[0][0]).toBe("/auth/otp/verify");
    expect((backend.mock.calls[0][1].headers as Headers).get("accept-language")).toBe("en");
  });

  it("passes API errors through without touching cookies", async () => {
    const backend = vi.fn().mockResolvedValue(
      Response.json({ code: "OTP_INVALID" }, { status: 400 }),
    );
    const { response, tokenUpdate } = await run("otp/verify", backend);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "OTP_INVALID" });
    expect(tokenUpdate).toBeUndefined();
  });

  it("forwards OTP requests, including rate limiting", async () => {
    const backend = vi.fn().mockResolvedValue(
      Response.json({ code: "RATE_LIMITED" }, { status: 429 }),
    );
    const { response } = await run("otp/request", backend, {}, '{"phone":"+201012345678"}');
    expect(response.status).toBe(429);
    expect(backend.mock.calls[0][0]).toBe("/auth/otp/request");
  });

  it("logs out with the access token and always clears the cookies", async () => {
    const backend = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const { response, tokenUpdate } = await run("logout", backend, { accessToken: "a" });

    expect(response.status).toBe(200);
    expect(tokenUpdate).toEqual({ type: "clear" });
    expect((backend.mock.calls[0][1].headers as Headers).get("authorization")).toBe("Bearer a");
  });

  it("clears the cookies even when the API is unreachable", async () => {
    const backend = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const { tokenUpdate } = await run("logout", backend, { accessToken: "a" });
    expect(tokenUpdate).toEqual({ type: "clear" });
  });
});
