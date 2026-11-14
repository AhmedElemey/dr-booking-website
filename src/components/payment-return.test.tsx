import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { parsePaymentReturn, rememberPayment } from "@/lib/payments";
import { problem, renderWithIntl, stubApi } from "@/test/render";

import { PayButton, canPayOnline } from "./pay-button";
import { PaymentReturn } from "./payment-return";

const fast = { intervalMs: 0, sleep: async () => {} };
const payment = (status: string) => Response.json({ id: "p1", appointmentId: "a1", amountEgp: 350, status });

describe("PaymentReturn", () => {
  it("polls the payment until it settles, then reports success and asks for a reload", async () => {
    const statuses = ["Pending", "Pending", "Paid"];
    let n = 0;
    stubApi({ "GET /api/payments/p1": () => payment(statuses[n++]) });
    const onSettled = vi.fn();
    renderWithIntl(
      <PaymentReturn
        appointmentId="a1"
        info={parsePaymentReturn("?payment=return&paymentId=p1&status=paid")}
        onSettled={onSettled}
        poll={fast}
      />,
    );

    expect(screen.getByText("Checking your payment…")).toBeTruthy();
    expect(await screen.findByText("Payment received.")).toBeTruthy();
    expect(n).toBe(3);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("never trusts the status in the URL: a 'paid' hint with a Failed payment shows failure and a retry", async () => {
    const calls = stubApi({
      "GET /api/payments/p1": () => payment("Failed"),
      "POST /api/appointments/a1/pay": () =>
        Response.json({ paymentId: "p2", checkoutUrl: "https://pay.example/checkout" }),
    });
    const onSettled = vi.fn();
    renderWithIntl(
      <PaymentReturn
        appointmentId="a1"
        info={parsePaymentReturn("?payment=return&paymentId=p1&status=paid")}
        onSettled={onSettled}
        poll={fast}
      />,
    );
    expect(await screen.findByText("The payment did not go through.")).toBeTruthy();
    expect(screen.getByText(/You have not been charged/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pay online" })).toBeTruthy();
    expect(onSettled).not.toHaveBeenCalled();
    expect(calls.map((c) => c.key)).toEqual(["GET /api/payments/p1"]);
  });

  it("says the payment is still being confirmed when polling runs out, and can check again", async () => {
    let n = 0;
    stubApi({ "GET /api/payments/p1": () => payment(++n > 3 ? "Paid" : "Pending") });
    renderWithIntl(
      <PaymentReturn appointmentId="a1" info={{ isReturn: true, paymentId: "p1" }} poll={{ ...fast, maxAttempts: 3 }} />,
    );
    expect(await screen.findByText(/still being confirmed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText("Payment received.")).toBeTruthy();
  });

  it("falls back to the payment remembered before the redirect when the URL has no id", async () => {
    rememberPayment("a7", "p1");
    const calls = stubApi({ "GET /api/payments/p1": () => payment("Paid") });
    renderWithIntl(<PaymentReturn appointmentId="a7" info={{ isReturn: true }} poll={fast} />);
    expect(await screen.findByText("Payment received.")).toBeTruthy();
    expect(calls[0].key).toBe("GET /api/payments/p1");
  });

  it("handles a return with no payment id at all without calling the API", async () => {
    const calls = stubApi({});
    renderWithIntl(<PaymentReturn appointmentId="never-paid" info={{ isReturn: true }} poll={fast} />);
    expect(await screen.findByText(/latest payment status/)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("shows a friendly message when the payment cannot be read", async () => {
    stubApi({ "GET /api/payments/p1": () => problem("PROVIDER_ERROR", 502) });
    renderWithIntl(<PaymentReturn appointmentId="a1" info={{ isReturn: true, paymentId: "p1" }} poll={fast} />, "ar");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("تعذر الاتصال");
    expect(screen.getByRole("button", { name: "تحقق مرة أخرى" })).toBeTruthy();
  });
});

describe("PayButton", () => {
  it("posts the return URL for this locale and redirects to the checkout", async () => {
    const calls = stubApi({
      "POST /api/appointments/a1/pay": () =>
        Response.json({ paymentId: "p9", checkoutUrl: "https://pay.example/checkout?x=1" }),
    });
    const navigate = vi.fn();
    renderWithIntl(<PayButton appointmentId="a1" navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Pay online" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://pay.example/checkout?x=1"));
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.returnUrl).toBe(`${window.location.origin}/en/appointments/a1?payment=return`);
    expect(sessionStorage.getItem("ml-payment-a1")).toBe("p9");
  });

  it("maps PAYMENT_NOT_ALLOWED to a friendly message and stays on the page", async () => {
    stubApi({ "POST /api/appointments/a1/pay": () => problem("PAYMENT_NOT_ALLOWED", 409) });
    const navigate = vi.fn();
    renderWithIntl(<PayButton appointmentId="a1" navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Pay online" }));
    expect(await screen.findByText(/cannot be paid online/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("canPayOnline", () => {
  const base = {
    status: "Confirmed",
    endsAt: "2099-01-01T10:00:00Z",
    paymentStatus: "Unpaid",
    totalEgp: 300,
  } as Parameters<typeof canPayOnline>[0];
  it("needs a confirmed, future, unpaid appointment with something to pay", () => {
    expect(canPayOnline(base)).toBe(true);
    expect(canPayOnline({ ...base, paymentStatus: "Paid" })).toBe(false);
    expect(canPayOnline({ ...base, paymentStatus: "Pending" })).toBe(false);
    expect(canPayOnline({ ...base, totalEgp: 0 })).toBe(false);
    expect(canPayOnline({ ...base, status: "Cancelled" })).toBe(false);
    expect(canPayOnline({ ...base, endsAt: "2000-01-01T10:00:00Z" })).toBe(false);
  });
});
