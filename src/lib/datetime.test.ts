import { describe, expect, it } from "vitest";

import {
  addDays,
  appointmentParts,
  formatAppointmentDate,
  formatAppointmentTime,
  formatEgp,
  formatHHmm,
  parseLocal,
  todayInZone,
  toLocalIso,
  toLocalIsoWithOffset,
  zonedTimeToUtc,
} from "./datetime";

describe("clinic-local formatting", () => {
  const appointment = {
    startsAt: "2026-11-02T07:00:00Z",
    startsAtLocal: "2026-11-02T09:00:00",
    timezone: "Africa/Cairo",
  };

  it("parses the wall-clock fields of startsAtLocal", () => {
    expect(parseLocal("2026-11-02T09:30:00")).toEqual({
      year: 2026,
      month: 11,
      day: 2,
      hour: 9,
      minute: 30,
    });
    expect(parseLocal("2026-11-02T09:30:00+02:00")?.hour).toBe(9);
    expect(parseLocal("garbage")).toBeNull();
  });

  it("shows the clinic time, not the device zone", () => {
    expect(formatAppointmentTime(appointment, "en")).toMatch(/^0?9:00\s?am$/i);
    expect(formatAppointmentDate(appointment, "en")).toContain("2 November 2026");
  });

  it("formats Arabic with Arabic-Indic digits and the Arabic month", () => {
    expect(formatAppointmentTime(appointment, "ar")).toContain("٩:٠٠");
    expect(formatAppointmentDate(appointment, "ar")).toContain("نوفمبر");
    expect(formatAppointmentDate(appointment, "ar")).toContain("٢٠٢٦");
  });

  it("falls back to converting startsAt into the clinic zone", () => {
    const parts = appointmentParts({ startsAt: "2026-11-02T07:00:00Z", timezone: "Africa/Cairo" });
    expect(parts).toMatchObject({ day: 2, hour: 9, minute: 0 });
  });

  it("formats the API's HH:mm slot label", () => {
    expect(formatHHmm("16:30", "en")).toMatch(/^0?4:30\s?pm$/i);
    expect(formatHHmm("16:30", "ar")).toContain("٤:٣٠");
  });
});

describe("zones and date keys", () => {
  it("applies Egypt's DST rules from tzdata (summer UTC+3, winter UTC+2)", () => {
    expect(zonedTimeToUtc("2026-07-01", "09:00", "Africa/Cairo").toISOString()).toBe(
      "2026-07-01T06:00:00.000Z",
    );
    expect(zonedTimeToUtc("2026-12-01", "09:00", "Africa/Cairo").toISOString()).toBe(
      "2026-12-01T07:00:00.000Z",
    );
  });

  it("round-trips through toLocalIso", () => {
    const utc = zonedTimeToUtc("2026-12-01", "17:30", "Africa/Cairo");
    expect(toLocalIso(utc, "Africa/Cairo")).toBe("2026-12-01T17:30:00");
  });

  it("computes today in the clinic zone across midnight", () => {
    expect(todayInZone("Africa/Cairo", new Date("2026-12-01T22:30:00Z"))).toBe("2026-12-02");
    expect(todayInZone("Africa/Cairo", new Date("2026-12-01T21:30:00Z"))).toBe("2026-12-01");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("toLocalIsoWithOffset", () => {
  it("matches the API format with Cairo's winter and summer offsets", () => {
    expect(toLocalIsoWithOffset(new Date("2026-10-31T08:00:00Z"), "Africa/Cairo")).toBe("2026-10-31T10:00:00+02:00");
    expect(toLocalIsoWithOffset(new Date("2026-07-01T06:00:00Z"), "Africa/Cairo")).toBe("2026-07-01T09:00:00+03:00");
  });
});

describe("formatEgp", () => {
  it("formats whole Egyptian pounds per locale", () => {
    expect(formatEgp(300, "en")).toMatch(/EGP/);
    expect(formatEgp(300, "en")).toMatch(/300/);
    expect(formatEgp(1250, "ar")).toContain("١٬٢٥٠");
  });
});
