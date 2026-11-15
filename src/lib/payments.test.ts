import { describe, expect, it, vi } from "vitest";

import {
  isSettled,
  parsePaymentReturn,
  paymentReturnUrl,
  pollUntil,
  recallPayment,
  rememberPayment,
  verdictOf,
} from "./payments";

describe("paymentReturnUrl", () => {
  it("is <site origin>/<locale>/appointments/<id>?payment=return", () => {
    expect(paymentReturnUrl("https://moonlight.example", "ar", "a1")).toBe(
      "https://moonlight.example/ar/appointments/a1?payment=return",
    );
    expect(paymentReturnUrl("http://localhost:3000/", "en", "a b")).toBe(
      "http://localhost:3000/en/appointments/a%20b?payment=return",
    );
  });
});

describe("parsePaymentReturn", () => {
  it("reads the payment id and provider hint from the return query", () => {
    expect(parsePaymentReturn("?payment=return&paymentId=p1&status=paid")).toEqual({
      isReturn: true,
      paymentId: "p1",
      hint: "paid",
    });
  });

  it("tolerates a provider that appended its parameters with a second question mark", () => {
    expect(parsePaymentReturn("?payment=return?paymentId=p9&status=failed")).toEqual({
      isReturn: true,
      paymentId: "p9",
      hint: "failed",
    });
  });

  it("accepts URLSearchParams and treats a plain page view as not a return", () => {
    expect(parsePaymentReturn(new URLSearchParams({ payment: "return", paymentId: "p2" })).paymentId).toBe("p2");
    expect(parsePaymentReturn("")).toEqual({ isReturn: false, paymentId: undefined, hint: undefined });
    expect(parsePaymentReturn("?payment=other").isReturn).toBe(false);
  });
});

describe("pollUntil", () => {
  it("polls until the payment leaves Pending", async () => {
    const statuses = ["Pending", "Pending", "Paid"] as const;
    let calls = 0;
    const sleep = vi.fn(async () => {});
    const result = await pollUntil(async () => ({ status: statuses[calls++] }), isSettled, { sleep });
    expect(result.status).toBe("Paid");
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts and returns the last (still pending) result", async () => {
    let calls = 0;
    const result = await pollUntil(async () => ({ status: "Pending" as const, n: ++calls }), isSettled, {
      maxAttempts: 3,
      sleep: async () => {},
    });
    expect(result.n).toBe(3);
  });

  it("stops when cancelled", async () => {
    let calls = 0;
    await pollUntil(async () => ({ status: "Pending" as const, n: ++calls }), isSettled, {
      sleep: async () => {},
      cancelled: () => calls >= 2,
    });
    expect(calls).toBe(2);
  });
});

describe("verdictOf", () => {
  it("collapses provider statuses to what the patient needs to know", () => {
    expect(verdictOf("Paid")).toBe("paid");
    expect(verdictOf("Failed")).toBe("failed");
    expect(verdictOf("Cancelled")).toBe("failed");
    expect(verdictOf("Refunded")).toBe("refunded");
    expect(verdictOf("Pending")).toBe("pending");
  });
});

describe("remembered payment", () => {
  it("round-trips through sessionStorage", () => {
    rememberPayment("a1", "p1");
    expect(recallPayment("a1")).toBe("p1");
    expect(recallPayment("other")).toBeUndefined();
  });
});
