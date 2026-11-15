import type { Payment } from "./api/types";

// Online payment helpers: the return URL we hand to the API, reading what the
// provider's redirect brings back, and polling until the payment settles.

/** `<site origin>/<locale>/appointments/<id>?payment=return`, the URL the checkout sends the patient back to. */
export function paymentReturnUrl(origin: string, locale: string, appointmentId: string): string {
  return `${origin.replace(/\/+$/, "")}/${locale}/appointments/${encodeURIComponent(appointmentId)}?payment=return`;
}

export type PaymentReturn = {
  /** True when the patient came back from a checkout (`?payment=return`). */
  isReturn: boolean;
  paymentId?: string;
  /** Raw status the provider put in the URL. Never trusted: the API is asked instead. */
  hint?: string;
};

/**
 * Reads the query string of the return page. Tolerates a provider that appends
 * its own parameters with `?` instead of `&` (`?payment=return?paymentId=...`).
 */
export function parsePaymentReturn(search: string | URLSearchParams): PaymentReturn {
  const text = typeof search === "string" ? search : search.toString();
  const pick = (key: string) => {
    const match = new RegExp(`(?:^|[?&])${key}=([^&?#]*)`).exec(text);
    if (!match) return undefined;
    try {
      return decodeURIComponent(match[1]) || undefined;
    } catch {
      return match[1] || undefined;
    }
  };
  return {
    isReturn: /(?:^|[?&])payment=return(?:$|[&?#])/.test(text),
    paymentId: pick("paymentId"),
    hint: pick("status"),
  };
}

const storageKey = (appointmentId: string) => `ml-payment-${appointmentId}`;

/** Remembers the payment started for an appointment, in case the provider drops `paymentId` on return. */
export function rememberPayment(appointmentId: string, paymentId: string) {
  try {
    sessionStorage.setItem(storageKey(appointmentId), paymentId);
  } catch {
    // Storage can be blocked; the return URL carries the id anyway.
  }
}

export function recallPayment(appointmentId: string): string | undefined {
  try {
    return sessionStorage.getItem(storageKey(appointmentId)) ?? undefined;
  } catch {
    return undefined;
  }
}

export type PollOptions = {
  intervalMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Stop polling early (component unmounted). */
  cancelled?: () => boolean;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Calls `load` until `done(result)`; returns the last result (still unsettled when attempts ran out). */
export async function pollUntil<T>(
  load: () => Promise<T>,
  done: (value: T) => boolean,
  { intervalMs = 1500, maxAttempts = 8, sleep = defaultSleep, cancelled = () => false }: PollOptions = {},
): Promise<T> {
  let last = await load();
  for (let attempt = 1; attempt < maxAttempts && !done(last) && !cancelled(); attempt++) {
    await sleep(intervalMs);
    if (cancelled()) break;
    last = await load();
  }
  return last;
}

export const isSettled = (payment: Pick<Payment, "status">) => payment.status !== "Pending";

export type PaymentVerdict = "paid" | "failed" | "refunded" | "pending";

export function verdictOf(status: Payment["status"]): PaymentVerdict {
  if (status === "Paid") return "paid";
  if (status === "Failed" || status === "Cancelled") return "failed";
  if (status === "Refunded") return "refunded";
  return "pending";
}
