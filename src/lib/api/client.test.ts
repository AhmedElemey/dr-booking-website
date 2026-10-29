import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { ApiError } from "./errors";

function fakeFetch(response: Response) {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("createApiClient", () => {
  it("calls the same-origin proxy with the locale and no token handling", async () => {
    const fetcher = fakeFetch(Response.json({ items: [], page: 1, pageSize: 50, totalCount: 0 }));
    const api = createApiClient("ar", fetcher);

    await api.listAppointments("upcoming");

    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/appointments?scope=upcoming&page=1&pageSize=50");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers["Accept-Language"]).toBe("ar");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("posts JSON bodies for booking", async () => {
    const fetcher = fakeFetch(Response.json({ id: "a1" }, { status: 201 }));
    const api = createApiClient("en", fetcher);

    await api.bookAppointment({ slotId: "s1", patientNote: "hi" });

    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/appointments");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ slotId: "s1", patientNote: "hi" });
  });

  it("routes OTP calls through /api/auth", async () => {
    const fetcher = fakeFetch(new Response(null, { status: 204 }));
    await createApiClient("ar", fetcher).requestOtp("+201012345678");
    expect((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "/api/auth/otp/request",
    );
  });

  it("surfaces API problems as ApiError", async () => {
    const fetcher = fakeFetch(
      Response.json({ code: "SLOT_TAKEN", detail: "taken" }, { status: 409 }),
    );
    const error = await createApiClient("ar", fetcher)
      .bookAppointment({ slotId: "s1" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("SLOT_TAKEN");
  });
});
