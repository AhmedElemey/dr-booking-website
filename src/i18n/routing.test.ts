import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { directionFor, routing } from "./routing";

describe("routing", () => {
  it("defaults to Arabic", () => {
    expect(routing.defaultLocale).toBe("ar");
    expect(routing.locales).toEqual(["ar", "en"]);
  });

  it("uses RTL for Arabic and LTR for English", () => {
    expect(directionFor("ar")).toBe("rtl");
    expect(directionFor("en")).toBe("ltr");
  });

  it("has the same message keys in both languages", () => {
    expect(Object.keys(ar.Home).sort()).toEqual(Object.keys(en.Home).sort());
  });
});
