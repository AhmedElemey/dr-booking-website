import Image from "next/image";

import { logoPublicPath } from "@/lib/clinic-config";

/** The clinic's logo from clinic.config.json, served by the /logo.svg route. */
export function BrandLogo({ className = "size-8" }: { className?: string }) {
  return (
    <Image
      src={logoPublicPath()}
      alt=""
      width={32}
      height={32}
      unoptimized
      aria-hidden="true"
      className={className}
    />
  );
}

export function MoonMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="16" fill="var(--primary)" />
      <path
        d="M20.5 7.2a9.2 9.2 0 1 0 4.3 15.6A8 8 0 0 1 20.5 7.2Z"
        fill="var(--primary-foreground)"
      />
      <circle cx="23.4" cy="9.4" r="1.3" fill="var(--accent)" />
    </svg>
  );
}
