import type { Features } from "./features";

/** The settings page exists when at least one messaging preference applies. */
export function hasSettings(features: Partial<Features>): boolean {
  return Boolean(features.whatsappReminders || features.promotions || features.recallCampaigns);
}
