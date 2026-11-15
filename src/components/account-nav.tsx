"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { hasSettings } from "@/lib/account";
import type { Features } from "@/lib/features";

type Item = { href: string; label: string };

/** Navigation inside the account area; entries of switched-off features are not rendered. */
export function AccountNav({ features }: { features: Partial<Features> }) {
  const t = useTranslations("AccountNav");
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/account/appointments", label: t("appointments") },
    ...(features.familyAccounts ? [{ href: "/account/family", label: t("family") }] : []),
    ...(features.waitingList ? [{ href: "/account/waiting-list", label: t("waitingList") }] : []),
    ...(features.patientRecords ? [{ href: "/account/records", label: t("records") }] : []),
    ...(hasSettings(features) ? [{ href: "/account/settings", label: t("settings") }] : []),
  ];
  if (items.length < 2) return null;

  return (
    <nav aria-label={t("label")} className="mb-6 flex gap-2 overflow-x-auto pb-1 text-sm font-semibold">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-2 ${
              active ? "bg-primary text-primary-foreground" : "bg-surface-muted hover:bg-border"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
