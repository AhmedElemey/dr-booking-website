import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  applyTokenUpdate,
  isProxiedPath,
  isSameOrigin,
  isSecureRequest,
  proxyAuthenticated,
  resetRefreshCache,
  type BackendCall,
} from "./session";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "content-type": "application/json" } });

const newTokens = {
  accessToken: "new-access",
  refreshToken: "new-refresh",
  expiresIn: 900,
};

function request(overrides: Partial<Parameters<typeof proxyAuthenticated>[0]> = {}) {
  return {
    path: "/appointments?scope=upcoming",
    method: "GET",
    headers: new Headers({ "accept-language": "ar", cookie: "ml_at=secret" }),
    tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
    backend: vi.fn() as unknown as BackendCall,
    ...overrides,
  };
}

describe("proxyAuthenticated", () => {
  beforeEach(() => resetRefreshCache());

  it("adds the Bearer header from the cookie token and never forwards cookies", async () => {
    const backend = vi.fn().mockResolvedValue(json({ items: [] }));
    const { response, tokenUpdate } = await proxyAuthenticated(request({ backend }));

    expect(response.status).toBe(200);
    expect(tokenUpdate).toBeUndefined();
    const [path, init] = backend.mock.calls[0];
    expect(path).toBe("/appointments?scope=upcoming");
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer old-access");
    expect(headers.get("accept-language")).toBe("ar");
    expect(headers.get("cookie")).toBeNull();
  });

  it("refreshes once on 401, retries with the new token and reports the new cookies", async () => {
    const backend = vi.fn(async (path: string, init: RequestInit) => {
      if (path === "/auth/refresh") {
        expect(JSON.parse(init.body as string)).toEqual({ refreshToken: "old-refresh" });
        return json(newTokens);
      }
      const auth = (init.headers as Headers).get("authorization");
      return auth === "Bearer new-access" ? json({ ok: true }) : json({ code: "UNAUTHORIZED" }, 401);
    });

    const { response, tokenUpdate } = await proxyAuthenticated(request({ backend }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(tokenUpdate).toEqual({ type: "set", ...newTokens });
    expect(backend.mock.calls.map(([p]) => p)).toEqual([
      "/appointments?scope=upcoming",
      "/auth/refresh",
      "/appointments?scope=upcoming",
    ]);
  });

  it("clears the session when the refresh token is rejected", async () => {
    const backend = vi.fn(async (path: string) =>
      path === "/auth/refresh" ? json({ code: "UNAUTHORIZED" }, 401) : json({ code: "UNAUTHORIZED" }, 401),
    );

    const { response, tokenUpdate } = await proxyAuthenticated(request({ backend }));

    expect(response.status).toBe(401);
    expect(tokenUpdate).toEqual({ type: "clear" });
    expect(backend).toHaveBeenCalledTimes(2);
  });

  it("refreshes first when the access cookie has expired but a refresh cookie remains", async () => {
    const backend = vi.fn(async (path: string, init: RequestInit) => {
      if (path === "/auth/refresh") return json(newTokens);
      expect((init.headers as Headers).get("authorization")).toBe("Bearer new-access");
      return json({ id: "me" });
    });

    const { response, tokenUpdate } = await proxyAuthenticated(
      request({ path: "/me", tokens: { refreshToken: "old-refresh" }, backend }),
    );

    expect(response.status).toBe(200);
    expect(tokenUpdate?.type).toBe("set");
    expect(backend).toHaveBeenCalledTimes(2);
  });

  it("does not refresh guests and passes the 401 through", async () => {
    const backend = vi.fn().mockResolvedValue(json({ code: "UNAUTHORIZED" }, 401));
    const { response, tokenUpdate } = await proxyAuthenticated(
      request({ path: "/me", tokens: {}, backend }),
    );

    expect(response.status).toBe(401);
    expect(tokenUpdate).toBeUndefined();
    expect(backend).toHaveBeenCalledTimes(1);
    expect((backend.mock.calls[0][1].headers as Headers).get("authorization")).toBeNull();
  });

  it("shares one refresh between parallel requests so token rotation is not replayed", async () => {
    let refreshCalls = 0;
    const backend = vi.fn(async (path: string, init: RequestInit) => {
      if (path === "/auth/refresh") {
        refreshCalls++;
        return json(newTokens);
      }
      return (init.headers as Headers).get("authorization") === "Bearer new-access"
        ? json({ ok: true })
        : json({ code: "UNAUTHORIZED" }, 401);
    });

    const [a, b] = await Promise.all([
      proxyAuthenticated(request({ path: "/me", backend })),
      proxyAuthenticated(request({ path: "/appointments", backend })),
    ]);

    expect(refreshCalls).toBe(1);
    expect(a.response.status).toBe(200);
    expect(b.response.status).toBe(200);
    expect(a.tokenUpdate).toEqual(b.tokenUpdate);
  });

  it("forwards the request body of mutations unchanged", async () => {
    const backend = vi.fn().mockResolvedValue(json({ id: "1" }, 201));
    const body = new TextEncoder().encode(JSON.stringify({ slotId: "s1" })).buffer as ArrayBuffer;

    const { response } = await proxyAuthenticated(
      request({
        method: "POST",
        path: "/appointments",
        body,
        headers: new Headers({ "content-type": "application/json" }),
        backend,
      }),
    );

    expect(response.status).toBe(201);
    const init = backend.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(body);
    expect((init.headers as Headers).get("content-type")).toBe("application/json");
  });

  it("never caches proxied responses", async () => {
    const backend = vi.fn().mockResolvedValue(json({}));
    const { response } = await proxyAuthenticated(request({ backend }));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("applyTokenUpdate", () => {
  it("sets httpOnly, SameSite=Lax cookies with the right lifetimes", () => {
    const jar = { set: vi.fn(), delete: vi.fn() };
    applyTokenUpdate(jar, { type: "set", ...newTokens }, true);

    expect(jar.set).toHaveBeenCalledWith(ACCESS_COOKIE, "new-access", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 900,
    });
    expect(jar.set).toHaveBeenCalledWith(REFRESH_COOKIE, "new-refresh", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: REFRESH_MAX_AGE_SECONDS,
    });
  });

  it("deletes both cookies on clear and ignores an absent update", () => {
    const jar = { set: vi.fn(), delete: vi.fn() };
    applyTokenUpdate(jar, { type: "clear" }, false);
    expect(jar.delete).toHaveBeenCalledWith(ACCESS_COOKIE);
    expect(jar.delete).toHaveBeenCalledWith(REFRESH_COOKIE);

    const idle = { set: vi.fn(), delete: vi.fn() };
    applyTokenUpdate(idle, undefined, false);
    expect(idle.set).not.toHaveBeenCalled();
    expect(idle.delete).not.toHaveBeenCalled();
  });
});

describe("request guards", () => {
  it("only proxies patient and public endpoints", () => {
    expect(isProxiedPath(["me"])).toBe(true);
    expect(isProxiedPath(["appointments", "abc", "cancel"])).toBe(true);
    expect(isProxiedPath(["doctors", "dr-x", "slots"])).toBe(true);
    expect(isProxiedPath(["waiting-list"])).toBe(true);
    expect(isProxiedPath(["coupons", "validate"])).toBe(true);
    const id = "75a6c2f0-1b2d-4e5f-8a9b-0c1d2e3f4a5b";
    expect(isProxiedPath(["payments", id])).toBe(true);
    expect(isProxiedPath(["payments", "return"])).toBe(false);
    expect(isProxiedPath(["payments", "mock-checkout"])).toBe(false);
    expect(isProxiedPath(["payments", "p1"])).toBe(false);
    expect(isProxiedPath(["me", "records", "e1", "attachment"], "GET")).toBe(true);
    expect(isProxiedPath(["me", "records", "e1", "attachment"], "POST")).toBe(false);
    expect(isProxiedPath(["me", "records"], "GET")).toBe(true);
    expect(isProxiedPath(["payments", "webhook", "paymob"])).toBe(false);
    expect(isProxiedPath(["payments", "mock-checkout", "p1"])).toBe(false);
    expect(isProxiedPath(["dashboard", "appointments"])).toBe(false);
    expect(isProxiedPath(["admin", "clinics"])).toBe(false);
    expect(isProxiedPath(["auth", "refresh"])).toBe(false);
    expect(isProxiedPath([])).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(isProxiedPath(["me", ".."])).toBe(false);
    expect(isProxiedPath(["appointments", "..", "..", "admin"])).toBe(false);
    expect(isProxiedPath(["appointments", "a/b"])).toBe(false);
    expect(isProxiedPath(["appointments", ""])).toBe(false);
  });

  it("accepts same-origin and header-less requests, rejects foreign origins", () => {
    expect(isSameOrigin(null, "drbooking.example")).toBe(true);
    expect(isSameOrigin("https://drbooking.example", "drbooking.example")).toBe(true);
    expect(isSameOrigin("https://evil.example", "drbooking.example")).toBe(false);
    expect(isSameOrigin("not a url", "drbooking.example")).toBe(false);
  });

  it("marks cookies Secure behind https and proxies", () => {
    expect(isSecureRequest("https://drbooking.example/api/me", null)).toBe(true);
    expect(isSecureRequest("http://localhost:3000/api/me", null)).toBe(false);
    expect(isSecureRequest("http://internal/api/me", "https")).toBe(true);
  });
});
