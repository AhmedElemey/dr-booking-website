import { afterEach, beforeEach, describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";

import { resetMockState } from "./api/mock/backend";
import { resetFeaturesCache } from "./features";

const env = { mock: process.env.MOCK_API, features: process.env.MOCK_FEATURES };

beforeEach(() => {
  process.env.MOCK_API = "1";
  resetFeaturesCache();
  resetMockState();
});
afterEach(() => {
  for (const [key, value] of [
    ["MOCK_API", env.mock],
    ["MOCK_FEATURES", env.features],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("sitemap", () => {
  it("lists both languages with hreflang alternates by default", async () => {
    const entries = await sitemap();
    expect(entries.some((e) => e.url.includes("/en/doctors"))).toBe(true);
    expect(entries.some((e) => e.url.includes("/ar/doctors/"))).toBe(true);
    expect(Object.keys(entries[0].alternates?.languages ?? {})).toEqual(["ar", "en", "x-default"]);
  });

  it("drops English URLs and hreflang when the English language is off", async () => {
    process.env.MOCK_FEATURES = '{"englishLanguage":false}';
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.url.includes("/en"))).toBe(false);
    for (const entry of entries) {
      expect(Object.keys(entry.alternates?.languages ?? {})).toEqual(["ar", "x-default"]);
    }
  });

  it("lists only landing, contact and legal pages when the website feature is off", async () => {
    process.env.MOCK_FEATURES = '{"website":false}';
    const paths = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(paths.some((p) => p.includes("/doctors"))).toBe(false);
    expect(paths).toContain("/ar/contact");
    expect(paths).toContain("/ar/terms");
    expect(paths).toContain("/ar/privacy");
  });
});
