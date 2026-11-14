import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DoctorSummary } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";

import { DoctorCard } from "./doctor-card";

const doctor: DoctorSummary = {
  id: "d1",
  slug: "sara-hassan",
  name: "Dr. Sara Hassan",
  photoUrl: null,
  specialty: { id: "s1", name: "General Dentistry" },
  clinic: { id: "c1", name: "Moonlight Dental Center", city: "Cairo" },
  yearsExperience: 12,
  consultationFeeEgp: 300,
};

describe("DoctorCard", () => {
  it("links to the profile and booking pages and shows the fee in EGP", () => {
    renderWithIntl(<DoctorCard doctor={doctor} />);

    expect(screen.getByRole("link", { name: "Dr. Sara Hassan" }).getAttribute("href")).toBe(
      "/en/doctors/sara-hassan",
    );
    expect(screen.getByRole("link", { name: "Book now" }).getAttribute("href")).toBe(
      "/en/doctors/sara-hassan/book",
    );
    expect(screen.getByText(/EGP/)).toBeTruthy();
    expect(screen.getByText("12 years of experience")).toBeTruthy();
    expect(screen.getByText("General Dentistry")).toBeTruthy();
  });

  it("uses Arabic copy, Arabic digits and Arabic-prefixed links", () => {
    renderWithIntl(<DoctorCard doctor={{ ...doctor, name: "د. سارة حسن" }} />, "ar");

    expect(screen.getByRole("link", { name: "احجز الآن" }).getAttribute("href")).toBe(
      "/ar/doctors/sara-hassan/book",
    );
    expect(screen.getByText(/خبرة ١٢ سنة/)).toBeTruthy();
    expect(screen.getByText(/ج\.م/)).toBeTruthy();
  });
});
