import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { problem, renderWithIntl, stubApi } from "@/test/render";

import { LoginPanel } from "./login-panel";

const user = {
  id: "u1",
  phone: "+201012345678",
  fullName: null,
  role: "Patient",
  preferredLanguage: "ar",
};

describe("LoginPanel", () => {
  it("rejects a non-Egyptian number without calling the API", () => {
    const calls = stubApi({});
    renderWithIntl(<LoginPanel onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    expect(screen.getByRole("alert").textContent).toBe("Enter a valid Egyptian mobile number.");
    expect(calls).toHaveLength(0);
  });

  it("requests an OTP for the normalized E.164 number, then verifies it", async () => {
    const onSuccess = vi.fn();
    const calls = stubApi({
      "POST /api/auth/otp/request": () => new Response(null, { status: 204 }),
      "POST /api/auth/otp/verify": () => Response.json({ isNewUser: true, user }),
    });
    renderWithIntl(<LoginPanel onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "010 1234 5678" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    const codeInput = await screen.findByLabelText("Verification code");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ phone: "+201012345678" });

    fireEvent.change(codeInput, { target: { value: "١٢٣٤٥٦" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ isNewUser: true, user }));
    expect(JSON.parse(calls[1].init.body as string)).toEqual({
      phone: "+201012345678",
      code: "123456",
    });
  });

  it("shows a localized message for a wrong code", async () => {
    stubApi({
      "POST /api/auth/otp/request": () => new Response(null, { status: 204 }),
      "POST /api/auth/otp/verify": () => problem("OTP_INVALID", 400),
    });
    renderWithIntl(<LoginPanel onSuccess={vi.fn()} />, "ar");

    fireEvent.change(screen.getByLabelText("رقم الموبايل"), { target: { value: "01012345678" } });
    fireEvent.click(screen.getByRole("button", { name: "إرسال الرمز" }));
    fireEvent.change(await screen.findByLabelText("رمز التحقق"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "تحقق ومتابعة" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("الرمز غير صحيح. راجعه وحاول مرة أخرى.");
  });

  it("maps rate limiting to a friendly message", async () => {
    stubApi({ "POST /api/auth/otp/request": () => problem("RATE_LIMITED", 429) });
    renderWithIntl(<LoginPanel onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "01012345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Too many attempts");
  });
});
