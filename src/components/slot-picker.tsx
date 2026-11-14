"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { ClosedDate, Slot, SlotDay } from "@/lib/api/types";
import {
  addDays,
  formatDateKey,
  formatDayNumber,
  formatHHmm,
  formatPlain,
  formatWeekdayShort,
  todayInZone,
} from "@/lib/datetime";

import { alertError, btnSecondary } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";
import { WaitingJoin } from "./waiting-join";

const DAYS_SHOWN = 14;

export type PickedSlot = { slot: Slot; date: string };

/** Switches that change what the picker offers. Everything is off unless passed. */
export type SlotPickerFeatures = {
  /** Show days without open slots and offer the waiting list on them. */
  waitingList?: boolean;
  /** Show the clinic's closed dates (holidays) with their names. */
  holidayCalendar?: boolean;
  /** Let the waiting-list join choose a family member. */
  familyAccounts?: boolean;
};

type Loaded =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      doctorId: string;
      days: SlotDay[];
      closed: ClosedDate[];
      timezone: string;
      from: string;
    };

/**
 * Date strip + grid of open slots, shown in the clinic timezone. Slots are
 * fetched through the same-origin proxy so the picker also serves reschedule.
 */
export function SlotPicker({
  doctorSlug,
  timezone,
  selectedSlotId,
  onSelect,
  refreshKey = 0,
  features = {},
  serviceId,
}: {
  doctorSlug: string;
  timezone: string;
  selectedSlotId?: string | null;
  onSelect: (picked: PickedSlot) => void;
  /** Change to force a reload (e.g. after `SLOT_TAKEN`). */
  refreshKey?: number;
  features?: SlotPickerFeatures;
  /** Service chosen so far, passed on when joining the waiting list. */
  serviceId?: string;
}) {
  const t = useTranslations("Booking");
  const common = useTranslations("Common");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [chosenDay, setChosenDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const from = todayInZone(timezone);
    api
      .getSlots(doctorSlug, from, addDays(from, DAYS_SHOWN - 1))
      .then((res) => {
        if (cancelled) return;
        setLoaded({
          status: "ready",
          doctorId: res.doctorId,
          days: res.days.filter((d) => d.slots.length > 0),
          closed: res.closedDates ?? [],
          timezone: res.timezone,
          from,
        });
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ status: "error", message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [api, doctorSlug, timezone, refreshKey, attempt, errorMessage]);

  if (loaded.status === "loading") {
    return (
      <p role="status" className="text-muted">
        {t("loadingSlots")}
      </p>
    );
  }

  if (loaded.status === "error") {
    return (
      <div className="space-y-3">
        <p role="alert" className={alertError}>
          {t("slotsError")} {loaded.message}
        </p>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            setLoaded({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          {common("retry")}
        </button>
      </div>
    );
  }

  const showClosed = Boolean(features.holidayCalendar);
  const showFull = Boolean(features.waitingList);
  const closedByDate = new Map(
    (showClosed ? loaded.closed : []).map((c) => [c.date, c.name] as const),
  );
  const slotsByDate = new Map(loaded.days.map((d) => [d.date, d.slots] as const));
  // With the waiting list or holidays on, every date of the window is shown, not only those with slots.
  const strip: { date: string; slots: Slot[] }[] =
    showClosed || showFull
      ? Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(loaded.from, i)).map((date) => ({
          date,
          slots: slotsByDate.get(date) ?? [],
        }))
      : loaded.days;

  if (strip.length === 0 || (strip.every((d) => d.slots.length === 0) && closedByDate.size === 0 && !showFull)) {
    return <p className="text-muted">{t("noSlotsAtAll")}</p>;
  }

  const firstWithSlots = strip.find((d) => d.slots.length > 0);
  const activeDate =
    chosenDay && strip.some((d) => d.date === chosenDay)
      ? chosenDay
      : (firstWithSlots ?? strip[0]).date;
  const activeDay = strip.find((d) => d.date === activeDate)!;
  const activeClosedName = closedByDate.get(activeDate);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted">{t("pickDay")}</h3>
        <div role="listbox" aria-label={t("pickDay")} className="flex gap-2 overflow-x-auto pb-2">
          {strip.map((day) => {
            const active = day.date === activeDate;
            const closed = closedByDate.has(day.date);
            return (
              <button
                key={day.date}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => setChosenDay(day.date)}
                className={`flex min-w-20 shrink-0 flex-col items-center rounded-2xl border px-3 py-2 text-sm ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : closed
                      ? "border-border bg-surface-muted text-muted hover:border-primary"
                      : "border-border bg-surface hover:border-primary"
                }`}
              >
                <span className="text-xs opacity-80">
                  {formatWeekdayShort(day.date, locale)}
                </span>
                <span className="text-lg font-bold">{formatDayNumber(day.date, locale)}</span>
                <span className="text-xs opacity-80">
                  {closed
                    ? t("dayClosed")
                    : day.slots.length === 0
                      ? t("dayFull")
                      : t("daySlots", {
                          count: day.slots.length,
                          n: formatPlain(day.slots.length, locale),
                        })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted">
          {t("pickTime")} — {formatDateKey(activeDate, locale)}
        </h3>
        {activeClosedName !== undefined ? (
          <p role="status" className="rounded-xl bg-surface-muted px-4 py-3 text-sm">
            <strong>{t("closedDay")}</strong> {activeClosedName}
          </p>
        ) : activeDay.slots.length === 0 ? (
          <div className="space-y-3">
            <p className="text-muted">{t("noSlotsDay")}</p>
            {showFull ? (
              <WaitingJoin
                doctorId={loaded.doctorId}
                date={activeDate}
                serviceId={serviceId}
                familyAccounts={features.familyAccounts}
              />
            ) : null}
          </div>
        ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {activeDay.slots.map((slot) => {
            const selected = slot.id === selectedSlotId;
            return (
              <li key={slot.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect({ slot, date: activeDate })}
                  className={`min-h-11 w-full rounded-xl border px-2 py-2 text-sm font-semibold ${
                    selected
                      ? "border-primary bg-primary font-bold text-primary-foreground shadow-md ring-2 ring-primary/40"
                      : "border-border bg-surface hover:border-primary"
                  }`}
                >
                  {formatHHmm(slot.local, locale)}
                </button>
              </li>
            );
          })}
        </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          {common("timezoneNote", { timezone: loaded.timezone })}
        </p>
      </div>
    </div>
  );
}
