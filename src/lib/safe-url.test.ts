import { describe, expect, it } from "vitest";

import { attachmentHref, safeNavigationUrl } from "./safe-url";

describe("safeNavigationUrl", () => {
  it("allows https and localhost http only", () => {
    expect(safeNavigationUrl("https://pay.example/c/1")).toBe("https://pay.example/c/1");
    expect(safeNavigationUrl("http://localhost:5267/x")).toBe("http://localhost:5267/x");
    expect(safeNavigationUrl("http://evil.example/x")).toBeNull();
    expect(safeNavigationUrl("javascript:alert(1)")).toBeNull();
    expect(safeNavigationUrl("data:text/html,x")).toBeNull();
    expect(safeNavigationUrl("/relative")).toBeNull();
    expect(safeNavigationUrl(undefined)).toBeNull();
  });
});

describe("attachmentHref", () => {
  it("routes API attachment paths through the site proxy", () => {
    expect(attachmentHref("/api/v1/me/records/e1/attachment")).toBe("/api/me/records/e1/attachment");
    expect(attachmentHref("https://api.example/api/v1/me/records/e1/attachment")).toBe("/api/me/records/e1/attachment");
    expect(attachmentHref("/me/records/e1/attachment")).toBe("/api/me/records/e1/attachment");
    expect(attachmentHref("/api/me/records/e1/attachment")).toBe("/api/me/records/e1/attachment");
  });
  it("rejects unsafe or unrelated links", () => {
    expect(attachmentHref("javascript:alert(1)")).toBeNull();
    expect(attachmentHref("/api/v1/dashboard/patients")).toBeNull();
    expect(attachmentHref("//evil.example/x")).toBeNull();
    expect(attachmentHref(null)).toBeNull();
  });
  it("passes through a safe legacy absolute URL", () => {
    expect(attachmentHref("https://cdn.example/uploads/records/a.pdf")).toBe("https://cdn.example/uploads/records/a.pdf");
    expect(attachmentHref("http://cdn.example/a.pdf")).toBeNull();
  });
});
