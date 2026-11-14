import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl, stubApi } from "@/test/render";

import { SlotPicker } from "./slot-picker";

const slots = {
  doctorId: "d1",
  timezone: "Africa/Cairo",
  days: [
    {
      date: "2026-11-02",
      slots: [
        { id: "s1", startsAt: "2026-11-02T07:00:00Z", endsAt: "2026-11-02T07:30:00Z", local: "09:00" },
        { id: "s2", startsAt: "2026-11-02T07:30:00Z", endsAt: "2026-11-02T08:00:00Z", local: "09:30" },
      ],
    },
    {
      date: "2026-11-03",
      slots: [
        { id: "s3", startsAt: "2026-11-03T14:00:00Z", endsAt: "2026-11-03T14:30:00Z", local: "16:00" },
      ],
    },
  ],
};

describe("SlotPicker", () => {
  it("shows clinic-local times and reports the chosen slot with its date", async () => {
    const calls = stubApi({
      "GET /api/doctors/sara-hassan/slots": () => Response.json(slots),
    });
    const onSelect = vi.fn();
    renderWithIntl(
      <SlotPicker doctorSlug="sara-hassan" timezone="Africa/Cairo" onSelect={onSelect} />,
    );

    const first = await screen.findByRole("button", { name: /^0?9:00\s?am$/i });
    expect(calls[0].key).toBe("GET /api/doctors/sara-hassan/slots");
    expect(screen.getByText(/Africa\/Cairo/)).toBeTruthy();

    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledWith({ slot: slots.days[0].slots[0], date: "2026-11-02" });
  });

  it("switches day and lists that day's slots", async () => {
    stubApi({ "GET /api/doctors/d/slots": () => Response.json(slots) });
    renderWithIntl(<SlotPicker doctorSlug="d" timezone="Africa/Cairo" onSelect={vi.fn()} />);

    await screen.findByRole("button", { name: /^0?9:00\s?am$/i });
    const days = screen.getAllByRole("option");
    expect(days).toHaveLength(2);

    fireEvent.click(days[1]);
    await waitFor(() => expect(screen.getByRole("button", { name: /^0?4:00\s?pm$/i })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /^0?9:00\s?am$/i })).toBeNull();
  });

  it("renders Arabic digits and labels in Arabic", async () => {
    stubApi({ "GET /api/doctors/d/slots": () => Response.json(slots) });
    renderWithIntl(<SlotPicker doctorSlug="d" timezone="Africa/Cairo" onSelect={vi.fn()} />, "ar");

    expect(await screen.findByRole("button", { name: /٩:٠٠/ })).toBeTruthy();
    expect(screen.getByText("اختر اليوم")).toBeTruthy();
  });

  it("says so when the doctor has no open slots", async () => {
    stubApi({
      "GET /api/doctors/d/slots": () => Response.json({ doctorId: "d1", timezone: "Africa/Cairo", days: [] }),
    });
    renderWithIntl(<SlotPicker doctorSlug="d" timezone="Africa/Cairo" onSelect={vi.fn()} />);

    expect(await screen.findByText(/no open times in the next two weeks/)).toBeTruthy();
  });

  it("offers a retry when loading fails", async () => {
    let attempts = 0;
    stubApi({
      "GET /api/doctors/d/slots": () =>
        ++attempts === 1 ? new Response("down", { status: 502 }) : Response.json(slots),
    });
    renderWithIntl(<SlotPicker doctorSlug="d" timezone="Africa/Cairo" onSelect={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: /^0?9:00\s?am$/i })).toBeTruthy();
  });
});
