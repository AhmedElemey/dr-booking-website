"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { Slot, SlotDay } from "@/lib/api/types";
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

const DAYS_SHOWN = 14;

export type PickedSlot = { slot: Slot; date: string };

type Loaded =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; days: SlotDay[]; timezone: string };

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
}: {
  doctorSlug: string;
  timezone: string;
  selectedSlotId?: string | null;
  onSelect: (picked: PickedSlot) => void;
  /** Change to force a reload (e.g. after `SLOT_TAKEN`). */
  refreshKey?: number;
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
          days: res.days.filter((d) => d.slots.length > 0),
          timezone: res.timezone,
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

  if (loaded.days.length === 0) {
    return <p className="text-muted">{t("noSlotsAtAll")}</p>;
  }

  const activeDate =
    chosenDay && loaded.days.some((d) => d.date === chosenDay)
      ? chosenDay
      : loaded.days[0].date;
  const activeDay = loaded.days.find((d) => d.date === activeDate)!;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted">{t("pickDay")}</h3>
        <div role="listbox" aria-label={t("pickDay")} className="flex gap-2 overflow-x-auto pb-2">
          {loaded.days.map((day) => {
            const active = day.date === activeDate;
            return (
              <button
                key={day.date}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => setChosenDay(day.date)}
                className={`flex min-w-20 shrink-0 flex-col items-center rounded-2xl border px-3 py-2 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface hover:border-primary"
                }`}
              >
                <span className="text-xs opacity-80">
                  {formatWeekdayShort(day.date, locale)}
                </span>
                <span className="text-lg font-bold">{formatDayNumber(day.date, locale)}</span>
                <span className="text-xs opacity-80">
                  {t("daySlots", {
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
          {t("pickTime")} · {formatDateKey(activeDate, locale)}
        </h3>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {activeDay.slots.map((slot) => {
            const selected = slot.id === selectedSlotId;
            return (
              <li key={slot.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect({ slot, date: activeDate })}
                  className={`min-h-11 w-full rounded-xl border px-2 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface hover:border-primary"
                  }`}
                >
                  {formatHHmm(slot.local, locale)}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">
          {common("timezoneNote", { timezone: loaded.timezone })}
        </p>
      </div>
    </div>
  );
}
