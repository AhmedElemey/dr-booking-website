// Date/time and money formatting. Appointment times always come from the clinic
// timezone fields of the API (`startsAtLocal` / `local` / `timezone`), never from
// the visitor's device zone.

export const CLINIC_TIMEZONE = "Africa/Cairo";

export type LocaleCode = "ar" | "en";

const INTL_LOCALE: Record<LocaleCode, string> = { ar: "ar-EG", en: "en-GB" };

export function intlLocale(locale: string): string {
  return INTL_LOCALE[locale as LocaleCode] ?? INTL_LOCALE.en;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/** Parses the wall-clock fields of an ISO local date-time such as `2026-11-02T09:00:00`. */
export function parseLocal(value: string): LocalParts | null {
  const m = LOCAL_RE.exec(value);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  };
}

function partsToUtcDate(p: LocalParts): Date {
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute));
}

/**
 * Wall-clock parts of an instant in an IANA zone. Used only as a fallback when
 * an API response lacks `startsAtLocal`.
 */
export function zonedParts(instant: Date | string, timeZone: string): LocalParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  const get = (type: string) =>
    Number(dtf.formatToParts(new Date(instant)).find((x) => x.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

type Timed = { startsAt: string; startsAtLocal?: string; timezone?: string };

/** The clinic wall-clock time of an appointment/slot as `LocalParts`. */
export function appointmentParts(a: Timed): LocalParts {
  return (
    (a.startsAtLocal ? parseLocal(a.startsAtLocal) : null) ??
    zonedParts(a.startsAt, a.timezone ?? CLINIC_TIMEZONE)
  );
}

export function formatLocalDate(
  parts: LocalParts,
  locale: string,
  style: "long" | "short" = "long",
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    ...(style === "long" ? { year: "numeric" } : {}),
  }).format(partsToUtcDate(parts));
}

export function formatLocalTime(parts: LocalParts, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(partsToUtcDate(parts));
}

/** `HH:mm` (the API's slot `local` field) formatted for the locale. */
export function formatHHmm(hhmm: string, locale: string): string {
  const [hour, minute] = hhmm.split(":").map(Number);
  return formatLocalTime(
    { year: 2000, month: 1, day: 1, hour: hour ?? 0, minute: minute ?? 0 },
    locale,
  );
}

/** `YYYY-MM-DD` as a short weekday + day label (e.g. "Mon 2 Nov"). */
export function formatDateKey(
  date: string,
  locale: string,
  style: "long" | "short" = "long",
): string {
  const [year, month, day] = date.split("-").map(Number);
  return formatLocalDate(
    { year, month, day, hour: 0, minute: 0 },
    locale,
    style,
  );
}

export function formatDayNumber(date: string, locale: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.NumberFormat(intlLocale(locale)).format(
    partsToUtcDate({ year, month, day, hour: 0, minute: 0 }).getUTCDate(),
  );
}

export function formatAppointmentDate(a: Timed, locale: string): string {
  return formatLocalDate(appointmentParts(a), locale);
}

export function formatAppointmentTime(a: Timed, locale: string): string {
  return formatLocalTime(appointmentParts(a), locale);
}

/** Today's clinic-local date as `YYYY-MM-DD`. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  const p = zonedParts(now, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Adds calendar days to a `YYYY-MM-DD` key. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

/** Egyptian pounds, whole units: "300 EGP" / "٣٠٠ ج.م.". */
export function formatEgp(amount: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** UTC instant of a clinic wall-clock time (used by the demo fixtures). */
export function zonedTimeToUtc(
  date: string,
  hhmm: string,
  timeZone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  // Start from the naive UTC guess and correct by the zone's offset at that time.
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wanted - seen;
  }
  return new Date(guess);
}

/** Local ISO date-time with UTC offset (`2026-10-31T10:00:00+02:00`), as the real API returns. */
export function toLocalIsoWithOffset(instant: Date, timeZone: string): string {
  const local = toLocalIso(instant, timeZone);
  const p = parseLocal(local)!;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const offsetMin = Math.round((asUtc - Math.floor(instant.getTime() / 60000) * 60000) / 60000);
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Local ISO date-time (no offset) of an instant in a zone. */
export function toLocalIso(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:00`;
}

/** Short weekday name of a `YYYY-MM-DD` key ("Mon" / "الاثنين"). */
export function formatWeekdayShort(date: string, locale: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Digits in the locale's numerals without grouping (years, counters, seconds). */
export function formatPlain(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), { useGrouping: false }).format(value);
}

/** Human-readable label for the clinic timezone; falls back to the IANA name. */
export function timezoneLabel(tz: string, locale: string): string {
  if (tz === "Africa/Cairo") return locale === "ar" ? "القاهرة" : "Cairo";
  return tz;
}
