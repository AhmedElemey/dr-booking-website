"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import type { Appointment } from "@/lib/api/types";
import type { Features } from "@/lib/features";
import type { PaymentReturn as ReturnInfo } from "@/lib/payments";

import { AppointmentCard } from "./appointments-view";
import { LoginPanel } from "./login-panel";
import { PaymentReturn } from "./payment-return";
import { alertError, alertSuccess, btnPrimary, btnSecondary, card } from "./ui";
import { useNow } from "./use-now";
import { useApiClient, useErrorMessage } from "./use-api";

type View =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; appointment: Appointment };

/** One appointment with all its details; also where the checkout returns the patient to. */
export function AppointmentDetail({
  id,
  selfService = true,
  features = {},
  paymentReturn,
}: {
  id: string;
  selfService?: boolean;
  features?: Partial<Features>;
  paymentReturn?: ReturnInfo;
}) {
  const t = useTranslations("Account");
  const common = useTranslations("Common");
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [view, setView] = useState<View>({ status: "loading" });
  const [flash, setFlash] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const now = useNow(60_000);
  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    api
      .getAppointment(id)
      .then((appointment) => {
        if (!cancelled) setView({ status: "ready", appointment });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) setView({ status: "guest" });
        else if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          setView({ status: "missing" });
        } else setView({ status: "error", message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [api, errorMessage, id, reloadKey]);

  if (view.status === "loading") {
    return (
      <p role="status" className="text-muted">
        {common("loading")}
      </p>
    );
  }
  if (view.status === "guest") {
    return (
      <section className={`${card} max-w-lg space-y-4`}>
        <h2 className="text-xl font-bold">{t("loginTitle")}</h2>
        <p className="text-muted">{t("loginText")}</p>
        <LoginPanel
          onSuccess={() => {
            setView({ status: "loading" });
            reload();
          }}
        />
      </section>
    );
  }
  if (view.status === "missing") {
    return (
      <div className={`${card} space-y-3 text-center`}>
        <p className="text-lg font-bold">{t("detailMissing")}</p>
        <Link href="/account/appointments" className={btnPrimary}>
          {t("backToList")}
        </Link>
      </div>
    );
  }
  if (view.status === "error") {
    return (
      <div className="space-y-3">
        <p role="alert" className={alertError}>
          {t("loadError")} {view.message}
        </p>
        <button type="button" className={btnSecondary} onClick={reload}>
          {common("retry")}
        </button>
      </div>
    );
  }

  const { appointment } = view;
  return (
    <div className="space-y-5">
      {features.onlinePayments && paymentReturn?.isReturn ? (
        <PaymentReturn appointmentId={id} info={paymentReturn} onSettled={reload} />
      ) : null}
      {flash ? (
        <p role="status" className={alertSuccess}>
          {flash}
        </p>
      ) : null}
      <AppointmentCard
        appointment={appointment}
        upcoming={appointment.status === "Confirmed" && new Date(appointment.endsAt).getTime() > now}
        selfService={selfService}
        features={features}
        onChanged={(message) => {
          setFlash(message);
          reload();
        }}
      />
      <Link href="/account/appointments" className={btnSecondary}>
        {t("backToList")}
      </Link>
    </div>
  );
}
