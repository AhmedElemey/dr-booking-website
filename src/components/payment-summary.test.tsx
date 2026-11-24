import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { PaymentSummary } from "./payment-summary";

describe("PaymentSummary", () => {
  it("shows the deposit paid and the balance due at the clinic", () => {
    renderWithIntl(
      <PaymentSummary
        appointment={{ priceEgp: 300, discountEgp: 0, totalEgp: 300, paymentStatus: "DepositPaid", depositPaidEgp: 100 }}
        showStatus
      />,
    );
    expect(screen.getByText("Deposit paid online")).toBeTruthy();
    expect(screen.getByText("Balance at the clinic")).toBeTruthy();
    expect(screen.getByText(/EGP\s?200|200\s?EGP/)).toBeTruthy();
    expect(screen.getByText("Deposit paid")).toBeTruthy();
  });

  it("shows no deposit rows for a fully paid visit", () => {
    renderWithIntl(
      <PaymentSummary
        appointment={{ priceEgp: 300, discountEgp: 0, totalEgp: 300, paymentStatus: "Paid", depositPaidEgp: 0 }}
        showStatus
      />,
    );
    expect(screen.queryByText("Balance at the clinic")).toBeNull();
  });
});
