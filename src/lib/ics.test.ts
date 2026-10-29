import { describe, expect, it } from "vitest";

import type { Appointment } from "./api/types";
import { buildIcs } from "./ics";

const appointment = {
  id: "a1",
  startsAt: "2026-11-02T07:00:00Z",
  endsAt: "2026-11-02T07:30:00Z",
  clinic: { name: "Moonlight, Maadi", address: "12 Road 9; Cairo" },
} as Appointment;

describe("buildIcs", () => {
  it("emits UTC start/end and escapes text", () => {
    const ics = buildIcs(appointment, "Visit; with, Dr");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261102T070000Z");
    expect(ics).toContain("DTEND:20261102T073000Z");
    expect(ics).toContain("SUMMARY:Visit\; with\\, Dr");
    expect(ics).toContain("LOCATION:Moonlight\\, Maadi\\, 12 Road 9\; Cairo");
    expect(ics.endsWith("\r\n")).toBe(true);
  });
});
