import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { problem, renderWithIntl, stubApi } from "@/test/render";

import { CouponField, type CouponState } from "./coupon-field";

const field = () => screen.getByLabelText("Coupon code") as HTMLInputElement;

function setup(route: (body: Record<string, unknown>) => Response | Promise<Response>) {
  const onChange = vi.fn<(state: CouponState) => void>();
  const calls = stubApi({
    "POST /api/coupons/validate": (_url, init) => route(JSON.parse(init.body as string)),
  });
  const view = renderWithIntl(<CouponField doctorId="d1" serviceId="sv1" onChange={onChange} />);
  return { onChange, calls, view };
}

describe("CouponField", () => {
  it("validates on Apply and shows the saving, reporting the valid code upward", async () => {
    const { onChange, calls } = setup(() => Response.json({ valid: true, discountEgp: 90, totalEgp: 360 }));
    fireEvent.change(field(), { target: { value: "welcome20" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText(/Code WELCOME20 applied: you save/)).toBeTruthy();
    expect(screen.getByText(/EGP\s?90|90\s?EGP/)).toBeTruthy();
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ code: "WELCOME20", doctorId: "d1", serviceId: "sv1" });
    const last = onChange.mock.calls.at(-1)![0];
    expect(last).toMatchObject({ status: "valid", code: "WELCOME20", check: { discountEgp: 90, totalEgp: 360 } });
  });

  it("explains a refused code with the API reason", async () => {
    const { onChange } = setup(() => Response.json({ valid: false, discountEgp: 0, totalEgp: 450, reason: "Expired" }));
    fireEvent.change(field(), { target: { value: "OLDDEAL" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(await screen.findByText("This offer has expired.")).toBeTruthy();
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ status: "invalid" });
  });

  it.each([
    ["NotFound", "We could not find this code. Please check it and try again."],
    ["PerPatientLimit", "You have already used this code the maximum number of times."],
    ["NotApplicable", "This code does not apply to this doctor or service."],
    ["Exhausted", "This offer has reached its limit of uses."],
  ])("maps reason %s to a friendly message", async (reason, message) => {
    setup(() => Response.json({ valid: false, discountEgp: 0, totalEgp: 0, reason }));
    fireEvent.change(field(), { target: { value: "ABC" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText(message)).toBeTruthy();
  });

  it("maps a 422 COUPON_INVALID problem through its reason, and server errors to a friendly message", async () => {
    setup(() =>
      Response.json({ code: "COUPON_INVALID", status: 422, reason: "NotStarted" }, { status: 422 }),
    );
    fireEvent.change(field(), { target: { value: "SOON" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("This offer has not started yet.")).toBeTruthy();
  });

  it("reports a network-level API error in plain words", async () => {
    setup(() => problem("RATE_LIMITED", 429));
    fireEvent.change(field(), { target: { value: "ABC" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText(/Too many attempts/)).toBeTruthy();
  });

  it("validates live shortly after typing stops, and clears when the box is emptied", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { onChange, calls } = setup(() => Response.json({ valid: true, discountEgp: 100, totalEgp: 350 }));
      fireEvent.change(field(), { target: { value: "SM" } });
      await vi.advanceTimersByTimeAsync(1000);
      expect(calls).toHaveLength(0); // too short to check

      fireEvent.change(field(), { target: { value: "SMILE100" } });
      expect(calls).toHaveLength(0); // debounced
      await vi.advanceTimersByTimeAsync(700);
      await waitFor(() => expect(calls).toHaveLength(1));
      expect(await screen.findByText(/Code SMILE100 applied/)).toBeTruthy();

      fireEvent.change(field(), { target: { value: "" } });
      expect(onChange.mock.calls.at(-1)![0]).toEqual({ status: "empty" });
      expect(screen.queryByText(/applied/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
