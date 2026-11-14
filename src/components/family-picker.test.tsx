import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { problem, renderWithIntl, stubApi } from "@/test/render";

import { FamilyPicker } from "./family-picker";
import { FamilyView } from "./family-view";

const members = [
  { id: "m1", fullName: "Yassin Ahmed", relation: "Child", dateOfBirth: "2019-05-14", gender: "Male" },
  { id: "m2", fullName: "Mona Ibrahim", relation: "Spouse" },
];

describe("FamilyPicker", () => {
  it("offers 'Myself' and each family member and reports the choice", async () => {
    stubApi({ "GET /api/me/family": () => Response.json(members) });
    const onChange = vi.fn();
    renderWithIntl(<FamilyPicker value="" onChange={onChange} />);

    const select = (await screen.findByLabelText("Booking for")) as HTMLSelectElement;
    expect(await screen.findByRole("option", { name: "Yassin Ahmed — Child" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Myself" })).toBeTruthy();
    expect(select.value).toBe("");

    fireEvent.change(select, { target: { value: "m2" } });
    expect(onChange).toHaveBeenCalledWith("m2", members[1]);
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("", null);
  });

  it("links to the family page and hints when nobody was added yet", async () => {
    stubApi({ "GET /api/me/family": () => Response.json([]) });
    renderWithIntl(<FamilyPicker value="" onChange={vi.fn()} />);
    expect(await screen.findByText(/You have not added anyone yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Manage family members" }).getAttribute("href")).toBe("/en/account/family");
  });

  it("speaks Arabic", async () => {
    stubApi({ "GET /api/me/family": () => Response.json(members) });
    renderWithIntl(<FamilyPicker value="" onChange={vi.fn()} />, "ar");
    expect(await screen.findByLabelText("الحجز لـ")).toBeTruthy();
    expect(screen.getByRole("option", { name: "لنفسي" })).toBeTruthy();
    expect(await screen.findByRole("option", { name: "Mona Ibrahim — زوج / زوجة" })).toBeTruthy();
  });

  it("shows a friendly error when the list cannot be loaded", async () => {
    stubApi({ "GET /api/me/family": () => problem("FEATURE_DISABLED", 403) });
    renderWithIntl(<FamilyPicker value="" onChange={vi.fn()} />);
    expect(await screen.findByText(/not available online/)).toBeTruthy();
  });
});

describe("FamilyView", () => {
  const me = { id: "u1", phone: "+201012345678", fullName: "Ahmed", role: "Patient", preferredLanguage: "en" };

  it("adds a member and reloads the list", async () => {
    let list = [members[0]];
    const calls = stubApi({
      "GET /api/me": () => Response.json(me),
      "GET /api/me/family": () => Response.json(list),
      "POST /api/me/family": (_url, init) => {
        const body = JSON.parse(init.body as string);
        list = [...list, { id: "m3", ...body }];
        return Response.json(list[1], { status: 201 });
      },
    });
    renderWithIntl(<FamilyView />);

    expect(await screen.findByText("Yassin Ahmed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add a family member" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Please enter the person's full name.");

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Laila Ahmed" } });
    fireEvent.change(screen.getByLabelText("Relation"), { target: { value: "Child" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Family member added.")).toBeTruthy();
    expect(await screen.findByText("Laila Ahmed")).toBeTruthy();
    const post = calls.find((c) => c.key === "POST /api/me/family")!;
    expect(JSON.parse(post.init.body as string)).toMatchObject({ fullName: "Laila Ahmed", relation: "Child" });
  });

  it("asks before removing a member", async () => {
    let list = [...members];
    const calls = stubApi({
      "GET /api/me": () => Response.json(me),
      "GET /api/me/family": () => Response.json(list),
      "DELETE /api/me/family/m1": () => {
        list = list.slice(1);
        return new Response(null, { status: 204 });
      },
    });
    renderWithIntl(<FamilyView />);
    await screen.findByText("Yassin Ahmed");
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.getByText("Remove Yassin Ahmed from your family members?")).toBeTruthy();
    expect(calls.some((c) => c.key.startsWith("DELETE"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
    expect(await screen.findByText("Family member removed.")).toBeTruthy();
    expect(screen.queryByText("Yassin Ahmed")).toBeNull();
  });
});
