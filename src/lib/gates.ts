import { cookies } from "next/headers";

import { redirect } from "@/i18n/navigation";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth/session";
import { getFeatures, type Features } from "./features";

/**
 * What a visitor may do on pages that need online booking:
 * - `unavailable`: the website feature is off, show the "please call" page
 * - `login`: guest browsing is off and the visitor is not signed in
 * - `open`: render the page
 */
export type Access = "open" | "unavailable" | "login";

export function decideCatalogAccess(
  features: Pick<Features, "website" | "guestBrowsing">,
  signedIn: boolean,
): Access {
  if (!features.website) return "unavailable";
  if (!features.guestBrowsing && !signedIn) return "login";
  return "open";
}

/** Booking, my-appointments and account pages only need the website feature. */
export function decideBookingAccess(features: Pick<Features, "website">): Access {
  return features.website ? "open" : "unavailable";
}

async function hasSession(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(ACCESS_COOKIE)?.value || jar.get(REFRESH_COOKIE)?.value);
}

/** Access for doctor search and profile pages. Reads cookies only when guest browsing is off. */
export async function catalogAccess(): Promise<Access> {
  const features = await getFeatures();
  const signedIn = features.website && !features.guestBrowsing ? await hasSession() : true;
  return decideCatalogAccess(features, signedIn);
}

export async function bookingAccess(): Promise<Access> {
  return decideBookingAccess(await getFeatures());
}

/** The login screen lives on the appointments page. */
export function redirectToLogin(locale: string): never {
  return redirect({ href: "/account/appointments", locale });
}

/** Bearer header for server-side catalog reads; only needed when guest browsing is off. */
export async function catalogAuthHeaders(): Promise<Record<string, string>> {
  const features = await getFeatures();
  if (features.guestBrowsing) return {};
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
