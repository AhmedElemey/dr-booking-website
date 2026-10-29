import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { directionFor, routing } from "./routing";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return [`${prefix}[${value.length}]`, ...value.flatMap((v, i) => keyPaths(v, `${prefix}[${i}]`))];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe("routing", () => {
  it("defaults to Arabic", () => {
    expect(routing.defaultLocale).toBe("ar");
    expect(routing.locales).toEqual(["ar", "en"]);
  });

  it("uses RTL for Arabic and LTR for English", () => {
    expect(directionFor("ar")).toBe("rtl");
    expect(directionFor("en")).toBe("ltr");
  });

  it("has exactly the same message keys (and list lengths) in both languages", () => {
    expect(keyPaths(ar).sort()).toEqual(keyPaths(en).sort());
  });

  it("has no empty translations", () => {
    for (const messages of [ar, en]) {
      const empty = keyPaths(messages).filter((path) => {
        const value = path
          .split(/\.|\[|\]/)
          .filter(Boolean)
          .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], messages);
        return typeof value === "string" && value.trim() === "";
      });
      expect(empty).toEqual([]);
    }
  });
});
