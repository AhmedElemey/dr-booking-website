import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DoctorProfile } from "@/lib/api/types";
import { problem, renderWithIntl, stubApi } from "@/test/render";

import { BookingFlow } from "./booking-flow";

const doctor: DoctorProfile = {
  id: "d1",
  slug: "sara-hassan",
  name: "Dr. Sara Hassan",
  photoUrl: null,
  specialty: { id: "s1", name: "General Dentistry" },
  clinic: {
    id: "c1",
    name: "Moonlight Dental Center",
    city: "Cairo",
    address: "12 Road 9, Maadi",
    phone: "+20225550100",
    timezone: "Africa/Cairo",
  },
  bio: null,
  services: [{ id: "sv1", name: "Check-up", durationMinutes: 30, priceEgp: 300 }],
};

const slots = {
  doctorId: "d1",
  timezone: "Africa/Cairo",
  days: [
    {
      date: "2026-11-02",
      slots: [{ id: "s1", startsAt: "2026-11-02T07:00:00Z", endsAt: "2026-11-02T07:30:00Z", local: "09:00" }],
    },
  ],
};

const patient = { id: "u1", phone: "+201012345678", fullName: "Ahmed", role: "Patient", preferredLanguage: "ar" };

const appointment = {
  id: "a1",
  status: "Confirmed",
  slotId: "s1",
  startsAt: "2026-11-02T07:00:00Z",
  endsAt: "2026-11-02T07:30:00Z",
  startsAtLocal: "2026-11-02T09:00:00",
  timezone: "Africa/Cairo",
  doctor: { id: "d1", slug: "sara-hassan", name: "Dr. Sara Hassan" },
  clinic: { id: "c1", name: "Moonlight Dental Center", address: "12 Road 9, Maadi", phone: "+20225550100" },
};

async function pickFirstSlot() {
  fireEvent.click(await screen.findByRole("button", { name: /^0?9:00\s?am$/i }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("BookingFlow", () => {
  it("sends a guest to phone verification after picking a slot", async () => {
    stubApi({
      "GET /api/doctors/sara-hassan/slots": () => Response.json(slots),
      "GET /api/me": () => problem("UNAUTHORIZED", 401),
    });
    renderWithIntl(<BookingFlow doctor={doctor} />);

    await pickFirstSlot();

    expect(await screen.findByText("Verify your phone number", { selector: "h2" })).toBeTruthy();
    expect(screen.getByLabelText("Mobile number")).toBeTruthy();
  });

  it("books straight away for a signed-in patient and shows the confirmation", async () => {
    const calls = stubApi({
      "GET /api/doctors/sara-hassan/slots": () => Response.json(slots),
      "GET /api/me": () => Response.json(patient),
      "POST /api/appointments": () => Response.json(appointment, { status: 201 }),
    });
    renderWithIntl(<BookingFlow doctor={doctor} />);

    await pickFirstSlot();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm booking" }));

    expect(await screen.findByText("Your appointment is confirmed")).toBeTruthy();
    const booking = calls.find((c) => c.key === "POST /api/appointments")!;
    expect(JSON.parse(booking.init.body as string)).toEqual({ slotId: "s1" });
    // Name is unchanged, so no profile update is sent.
    expect(calls.some((c) => c.key === "PUT /api/me")).toBe(false);
    expect(screen.getByText(/Pay at the clinic/)).toBeTruthy();
  });

  it("returns to the slot picker with a localized error when the slot was just taken", async () => {
    let slotLoads = 0;
    stubApi({
      "GET /api/doctors/sara-hassan/slots": () => {
        slotLoads++;
        return Response.json(slots);
      },
      "GET /api/me": () => Response.json(patient),
      "POST /api/appointments": () => problem("SLOT_TAKEN", 409),
    });
    renderWithIntl(<BookingFlow doctor={doctor} />);

    await pickFirstSlot();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm booking" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Someone just booked this time. Please pick another one.");
    await waitFor(() => expect(slotLoads).toBe(2));
    expect(await screen.findByRole("button", { name: /^0?9:00\s?am$/i })).toBeTruthy();
  });

  it("asks new users for their name and saves it before booking", async () => {
    const calls = stubApi({
      "GET /api/doctors/sara-hassan/slots": () => Response.json(slots),
      "GET /api/me": () => Response.json({ ...patient, fullName: null }),
      "PUT /api/me": () => Response.json(patient),
      "POST /api/appointments": () => Response.json(appointment, { status: 201 }),
    });
    renderWithIntl(<BookingFlow doctor={doctor} />);

    await pickFirstSlot();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm booking" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Please enter your full name.");

    fireEvent.change(screen.getByLabelText("Your full name"), { target: { value: "Ahmed" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));

    await screen.findByText("Your appointment is confirmed");
    const keys = calls.map((c) => c.key);
    expect(keys.indexOf("PUT /api/me")).toBeLessThan(keys.indexOf("POST /api/appointments"));
  });
});
