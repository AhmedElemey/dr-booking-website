import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, vi } from "vitest";

import { applyBrand } from "@/lib/clinic-config";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const MESSAGES = { ar: applyBrand(ar, "ar"), en: applyBrand(en, "en") };

export function renderWithIntl(ui: ReactElement, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Africa/Cairo">
      {ui}
    </NextIntlClientProvider>,
  );
}

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;

/** Stubs `fetch` with a router keyed by `METHOD /path`; unknown routes fail the test. */
export function stubApi(routes: Record<string, Route>) {
  const calls: { key: string; init: RequestInit }[] = [];
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const key = `${init.method ?? "GET"} ${url.split("?")[0]}`;
    calls.push({ key, init });
    const route = routes[key];
    if (!route) throw new Error(`Unexpected request: ${key}`);
    return route(url, init);
  });
  vi.stubGlobal("fetch", fetchStub);
  return calls;
}

export const problem = (code: string, status: number) =>
  Response.json({ code, status, title: code }, { status });
