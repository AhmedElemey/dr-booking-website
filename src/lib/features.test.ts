import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetMockState } from "./api/mock/backend";
import { clinicConfig } from "./clinic-config";
import {
  activeLocales,
  defaultFeatures,
  getFeatures,
  isFeatureDisabled,
  normalizeFeatures,
  resetFeaturesCache,
} from "./features";
import { ApiError } from "./api/errors";

const env = { mock: process.env.MOCK_API, features: process.env.MOCK_FEATURES };

beforeEach(() => {
  resetFeaturesCache();
  resetMockState();
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const [key, value] of [
    ["MOCK_API", env.mock],
    ["MOCK_FEATURES", env.features],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("normalizeFeatures", () => {
  it("uses the config defaults for missing or invalid keys and ignores unknown ones", () => {
    const result = normalizeFeatures({
      features: { website: false, guestBrowsing: "no", surprise: true },
    });
    expect(result).toEqual({ ...clinicConfig.features, website: false });
    expect(result).not.toHaveProperty("surprise");
  });

  it("falls back entirely for malformed payloads", () => {
    expect(normalizeFeatures(null)).toEqual(defaultFeatures());
    expect(normalizeFeatures({ features: "x" })).toEqual(defaultFeatures());
    expect(normalizeFeatures({})).toEqual(defaultFeatures());
  });
});

describe("getFeatures", () => {
  it("is served by the mock backend, with demo overrides", async () => {
    process.env.MOCK_API = "1";
    expect(await getFeatures()).toEqual(defaultFeatures());
    resetFeaturesCache();
    process.env.MOCK_FEATURES = '{"website":false,"englishLanguage":false}';
    const features = await getFeatures();
    expect(features.website).toBe(false);
    expect(features.englishLanguage).toBe(false);
    expect(features.multiBranch).toBe(true);
  });

  it("reads GET /api/v1/features from the API", async () => {
    delete process.env.MOCK_API;
    const fetchStub = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      Response.json({ features: { patientSelfService: false }, source: "console" }),
    );
    vi.stubGlobal("fetch", fetchStub);
    const features = await getFeatures();
    expect(features.patientSelfService).toBe(false);
    expect(String(fetchStub.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/features$/);
    expect(fetchStub.mock.calls[0]?.[1]).toMatchObject({ next: { revalidate: 60 } });
  });

  it("falls back to the config defaults when the API is down or errors", async () => {
    delete process.env.MOCK_API;
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await getFeatures()).toEqual(defaultFeatures());
    resetFeaturesCache();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    expect(await getFeatures()).toEqual(defaultFeatures());
  });

  it("caches for 60 seconds, keeps the last good copy on failure, and retries soon", async () => {
    delete process.env.MOCK_API;
    const ok = vi.fn(async () => Response.json({ features: { website: false } }));
    vi.stubGlobal("fetch", ok);
    const t0 = 1_000_000;
    expect((await getFeatures(t0)).website).toBe(false);
    await getFeatures(t0 + 30_000);
    expect(ok).toHaveBeenCalledTimes(1);

    const down = vi.fn(async () => { throw new TypeError("offline"); });
    vi.stubGlobal("fetch", down);
    expect((await getFeatures(t0 + 61_000)).website).toBe(false); // last good copy
    await getFeatures(t0 + 65_000);
    expect(down).toHaveBeenCalledTimes(1); // not hammering a dead API
    await getFeatures(t0 + 72_000);
    expect(down).toHaveBeenCalledTimes(2);
  });
});

describe("helpers", () => {
  it("serves only Arabic when English is off", () => {
    expect(activeLocales({ englishLanguage: true })).toEqual(["ar", "en"]);
    expect(activeLocales({ englishLanguage: false })).toEqual(["ar"]);
  });

  it("recognises FEATURE_DISABLED problems", () => {
    expect(isFeatureDisabled(new ApiError(403, "FEATURE_DISABLED", "x"))).toBe(true);
    expect(isFeatureDisabled(new ApiError(403, "FORBIDDEN", "x"))).toBe(false);
    expect(isFeatureDisabled(new Error("x"))).toBe(false);
  });
});
