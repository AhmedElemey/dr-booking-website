"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { Appointment } from "@/lib/api/types";
import { formatLocalTime, zonedParts } from "@/lib/datetime";

import { alertError, btnPrimary, btnSecondary } from "./ui";
import { useNow } from "./use-now";
import { useApiClient, useErrorMessage } from "./use-api";

export const VIDEO_OPENS_BEFORE_MIN = 15;
export const VIDEO_CLOSES_AFTER_MIN = 30;

/** The join window of a video visit: start minus 15 minutes until end plus 30 minutes. */
export function videoWindow(appointment: Pick<Appointment, "startsAt" | "endsAt">) {
  return {
    opensAt: new Date(appointment.startsAt).getTime() - VIDEO_OPENS_BEFORE_MIN * 60_000,
    closesAt: new Date(appointment.endsAt).getTime() + VIDEO_CLOSES_AFTER_MIN * 60_000,
  };
}

/** "Join video" for a confirmed video visit; enabled only inside the join window. */
export function VideoJoin({
  appointment,
  open = (url) => window.open(url, "_blank", "noopener,noreferrer"),
}: {
  appointment: Appointment;
  open?: (url: string) => void;
}) {
  const t = useTranslations("Video");
  const locale = useLocale();
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (appointment.mode !== "Video" || appointment.status !== "Confirmed") return null;
  const { opensAt, closesAt } = videoWindow(appointment);
  if (now > closesAt) return null;
  const inWindow = now >= opensAt;

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const { joinUrl } = await api.getVideoAccess(appointment.id);
      open(joinUrl);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const opensLabel = formatLocalTime(zonedParts(new Date(opensAt), appointment.timezone), locale);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={!inWindow || busy}
        onClick={() => void join()}
        className={inWindow ? btnPrimary : btnSecondary}
      >
        {t("join")}
      </button>
      {!inWindow ? <span className="text-sm text-muted">{t("opensAt", { time: opensLabel })}</span> : null}
      {error ? (
        <p role="alert" className={`${alertError} w-full`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function VideoBadge() {
  const t = useTranslations("Video");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
      <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true" fill="currentColor">
        <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h8A2.5 2.5 0 0 1 16 6.5v2.3l4.3-2.4c.7-.4 1.7.1 1.7.9v9.4c0 .8-1 1.3-1.7.9L16 15.2v2.3a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 17.5z" />
      </svg>
      {t("badge")}
    </span>
  );
}
