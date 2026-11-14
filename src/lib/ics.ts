import type { Appointment } from "./api/types";

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** A minimal iCalendar file for an appointment (UTC times, so any calendar shows the right local time). */
export function buildIcs(appointment: Appointment, summary: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Moonlight//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@moonlight`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(appointment.startsAt)}`,
    `DTEND:${icsDate(appointment.endsAt)}`,
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText(`${appointment.clinic.name}, ${appointment.clinic.address}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
