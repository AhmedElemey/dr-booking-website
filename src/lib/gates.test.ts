import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));

import { defaultFeatures } from "./features";
import { decideBookingAccess, decideCatalogAccess } from "./gates";

const base = defaultFeatures();

describe("decideCatalogAccess (search, doctor profile)", () => {
  it("is open by default", () => {
    expect(decideCatalogAccess(base, false)).toBe("open");
  });

  it("shows the call-the-clinic page when the website feature is off, even when signed in", () => {
    expect(decideCatalogAccess({ ...base, website: false }, false)).toBe("unavailable");
    expect(decideCatalogAccess({ ...base, website: false }, true)).toBe("unavailable");
  });

  it("sends guests to login when guest browsing is off, but lets signed-in patients in", () => {
    expect(decideCatalogAccess({ ...base, guestBrowsing: false }, false)).toBe("login");
    expect(decideCatalogAccess({ ...base, guestBrowsing: false }, true)).toBe("open");
  });
});

describe("decideBookingAccess (booking, my appointments)", () => {
  it("only depends on the website feature", () => {
    expect(decideBookingAccess(base)).toBe("open");
    expect(decideBookingAccess({ website: true, ...{ guestBrowsing: false } })).toBe("open");
    expect(decideBookingAccess({ ...base, website: false })).toBe("unavailable");
  });
});
