import { describe, expect, it } from "vitest";

import { englishRedirect } from "./locale-gate";

describe("englishRedirect", () => {
  it("leaves everything alone while English is enabled", () => {
    expect(englishRedirect("/en/doctors", true)).toBeNull();
  });

  it("sends /en routes to the same Arabic route when English is off", () => {
    expect(englishRedirect("/en", false)).toBe("/ar");
    expect(englishRedirect("/en/", false)).toBe("/ar/");
    expect(englishRedirect("/en/doctors/sara", false)).toBe("/ar/doctors/sara");
  });

  it("does not touch Arabic routes or look-alikes", () => {
    expect(englishRedirect("/ar/doctors", false)).toBeNull();
    expect(englishRedirect("/english", false)).toBeNull();
    expect(englishRedirect("/", false)).toBeNull();
  });
});
