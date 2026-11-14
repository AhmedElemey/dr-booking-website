import { describe, expect, it } from "vitest";

import { brandCss, darkTokens, lightTokens, mix, parseHex, readableOn, toHex } from "./colors";

const channelDistance = (a: string, b: string) =>
  Math.max(...parseHex(a).map((c, i) => Math.abs(c - parseHex(b)[i])));

describe("hex helpers", () => {
  it("round-trips and mixes", () => {
    expect(parseHex("#3F3CCF")).toEqual([63, 60, 207]);
    expect(toHex([63, 60, 207])).toBe("#3f3ccf");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#123456", "#ffffff", 0)).toBe("#123456");
  });

  it("rejects malformed colours", () => {
    expect(() => parseHex("#abc")).toThrow(/Invalid hex/);
  });

  it("chooses a readable foreground", () => {
    expect(readableOn("#3f3ccf")).toBe("#ffffff");
    expect(readableOn("#ffe082")).not.toBe("#ffffff");
  });
});

describe("brand tokens", () => {
  it("reproduces today's light palette for the default colours", () => {
    const t = lightTokens("#3F3CCF", "#0E9F9A");
    expect(t["--primary"]).toBe("#3f3ccf");
    expect(t["--accent"]).toBe("#0e9f9a");
    expect(t["--primary-foreground"]).toBe("#ffffff");
    expect(channelDistance(t["--primary-hover"], "#3330b0")).toBeLessThanOrEqual(6);
    expect(channelDistance(t["--accent-soft"], "#dcf5f3")).toBeLessThanOrEqual(6);
  });

  it("is close to today's dark palette for the default colours", () => {
    const t = darkTokens("#3F3CCF", "#0E9F9A");
    expect(channelDistance(t["--primary"], "#8b89ff")).toBeLessThanOrEqual(30);
    expect(channelDistance(t["--accent"], "#4fd1c5")).toBeLessThanOrEqual(30);
    expect(t["--primary-foreground"]).toBe("#0d0f24");
  });

  it("makes hover darker and soft lighter than the base colour", () => {
    const t = lightTokens("#1d6fa5", "#c2410c");
    const sum = (hex: string) => parseHex(hex).reduce((a, b) => a + b, 0);
    expect(sum(t["--primary-hover"])).toBeLessThan(sum(t["--primary"]));
    expect(sum(t["--accent-soft"])).toBeGreaterThan(sum(t["--accent"]));
  });

  it("emits light and dark CSS", () => {
    const css = brandCss("#3F3CCF", "#0E9F9A");
    expect(css).toMatch(/^:root\{--primary:#3f3ccf;/);
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    for (const name of ["--primary-hover", "--accent", "--accent-soft", "--primary-foreground"]) {
      expect(css).toContain(name);
    }
  });
});
