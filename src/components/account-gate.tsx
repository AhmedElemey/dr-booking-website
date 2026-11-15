"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { ApiError } from "@/lib/api/errors";
import type { User } from "@/lib/api/types";

import { LoginPanel } from "./login-panel";
import { alertError, btnSecondary, card } from "./ui";
import { useApiClient, useErrorMessage } from "./use-api";

type View =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "clinic" }
  | { status: "error"; message: string }
  | { status: "ready"; user: User };

/** Loads the signed-in patient for an account page; shows sign-in, clinic-account and error states itself. */
export function AccountGate({ children }: { children: (user: User) => ReactNode }) {
  const t = useTranslations("Account");
  const common = useTranslations("Common");
  const api = useApiClient();
  const errorMessage = useErrorMessage();
  const [view, setView] = useState<View>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    api
      .getMe()
      .then((user) => {
        if (!cancelled) setView(user.role === "Patient" ? { status: "ready", user } : { status: "clinic" });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) setView({ status: "guest" });
        else if (err instanceof ApiError && err.status === 403) setView({ status: "clinic" });
        else setView({ status: "error", message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [api, errorMessage, reloadKey]);

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
  if (view.status === "clinic") return <p className={alertError}>{t("clinicAccount")}</p>;
  if (view.status === "error") {
    return (
      <div className="space-y-3">
        <p role="alert" className={alertError}>
          {t("loadError")} {view.message}
        </p>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            setView({ status: "loading" });
            reload();
          }}
        >
          {common("retry")}
        </button>
      </div>
    );
  }
  return <>{children(view.user)}</>;
}
